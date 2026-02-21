import { getSession } from "@/lib/session";
import { logActivity, EVENTS } from "@/utils/audit";
import { receiptCreateSchema } from "@/validation/receipt.validation";
import { z } from "zod";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkAndCompleteMission } from "@/lib/rewards/missions";
import { triggerReferralMilestone } from "@/lib/rewards/referrals";


const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  from: z.string().optional(),
  to: z.string().optional(),
  category: z.string().optional(),
});


const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const handleValidationError = (error: unknown) => NextResponse.json({ error: 'Validation failed', details: error }, { status: 400 });
const handleDatabaseError = (error: unknown) => {
  console.error('Database error:', error);
  return NextResponse.json({ error: 'Database error' }, { status: 500 });
};
const paymentRequired = (message: string, data?: Record<string, unknown>) => NextResponse.json({ error: message, ...data }, { status: 402 });

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const userId = session.id;
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters
    const teamIdParam = searchParams.get("teamId");
    const queryParams = {
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      category: searchParams.get("category") || undefined,
      teamId: teamIdParam ? parseInt(teamIdParam) : undefined,
    };

    const validation = paginationSchema.extend({ teamId: z.number().optional() }).safeParse(queryParams);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { page, limit, from, to, category, teamId } = validation.data;
    const offset = (page - 1) * limit;

    // Build where clause
    const where: any = {}; // Using any to simplify dynamic type construction

    if (teamId) {
      // Team View Logic
      const member = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });

      if (!member) {
        return NextResponse.json({ error: "Access denied to this team" }, { status: 403 });
      }

      where.teamId = teamId;

      // Filter based on Role - Everyone in the team can see all receipts now
      if (['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'].includes(member.role)) {
        // See all receipts in team
      } else {
        where.userId = userId;
      }

    } else {
      // Personal View Logic
      where.userId = userId;
      where.teamId = null; // Strictly personal
    }

    if (from) {
      where.receiptDate = { ...where.receiptDate, gte: new Date(from) };
    }

    if (to) {
      where.receiptDate = { ...where.receiptDate, lte: new Date(to) };
    }

    if (category) {
      where.category = category;
    }

    const receipts = await prisma.receipt.findMany({
      where,
      orderBy: [
        { receiptDate: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: offset,
      take: limit,
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true }
        }
      }
    });

    const total = await prisma.receipt.count({ where });

    // Transform the data
    const transformedReceipts = receipts.map(receipt => ({
      id: receipt.id.toString(),
      receipt_date: receipt.receiptDate.toISOString().split('T')[0],
      merchant_name: receipt.merchantName,
      amount: receipt.amount.toString(),
      category: receipt.category,
      file_url: receipt.fileUrl,
      currency: receipt.currency,
      note: receipt.note,
      needs_review: receipt.needsReview,
      is_duplicate: receipt.isDuplicate,
      confidence: receipt.confidence?.toString() || null,
      created_at: receipt.createdAt.toISOString(),
      updated_at: receipt.updatedAt.toISOString(),
      team_id: receipt.teamId,
      user_name: receipt.user ? `${receipt.user.firstName} ${receipt.user.lastName}` : 'Unknown',
      user_email: receipt.user?.email || 'Unknown',
    }));

    return NextResponse.json({
      receipts: transformedReceipts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    console.error("GET /api/receipts error:", error);
    return handleDatabaseError(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return unauthorized();
    }

    const userId = session.id;
    const body = await request.json();

    // Check subscription limits for receipt uploads
    const subscriptionCheck = await checkSubscriptionLimit(userId, 'receipt_uploads');
    if (!subscriptionCheck.allowed) {
      return paymentRequired(subscriptionCheck.reason || 'Subscription limit reached', {
        upgradeRequired: subscriptionCheck.upgradeRequired,
        currentTier: subscriptionCheck.currentTier,
      });
    }


    // Validate input with Zod
    const validation = receiptCreateSchema.safeParse(body);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { file_url, merchant_name, receipt_date, amount, category, note, currency, teamId } = validation.data;

    // Team Permission Check
    if (teamId) {
      const member = await prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
      });
      // Need 'create_receipt' permission. Member role has it. Viewer doesn't.
      if (!member || (member.role === 'VIEWER')) { // Using simple check or import can()
        return NextResponse.json({ error: "Insufficient permissions to add receipts to this team" }, { status: 403 });
      }
    }

    // Check for existing OCR-processed receipt with the same file URL
    // If found, update it instead of creating a duplicate
    let receipt = await prisma.receipt.findFirst({
      where: {
        userId,
        fileUrl: file_url,
        status: { in: ['pending', 'completed'] }
      },
    });

    if (receipt) {
      // Update existing OCR-processed receipt
      receipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: {
          merchantName: merchant_name,
          receiptDate: new Date(receipt_date),
          amount,
          category,
          note: note || null,
          currency,
          status: 'completed', // Mark as completed since user has reviewed and confirmed
          updatedAt: new Date(),
          teamId: teamId || null,
        },
      });
    } else {
      // Check for duplicate receipts (same merchant, amount, date within 90 days) for new receipts only
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const duplicateCheck = await prisma.receipt.findFirst({
        where: {
          userId,
          merchantName: merchant_name,
          amount,
          receiptDate: new Date(receipt_date),
          createdAt: {
            gt: ninetyDaysAgo,
          },
        },
      });

      if (duplicateCheck) {
        return NextResponse.json({
          error: "Duplicate receipt detected",
          fieldErrors: {
            general: "A receipt with the same merchant, amount, and date already exists within the last 90 days"
          }
        }, { status: 409 });
      }

      // Create new receipt for manual entry
      receipt = await prisma.receipt.create({
        data: {
          userId,
          fileName: file_url.split("/").pop() || "",
          fileUrl: file_url,
          merchantName: merchant_name,
          receiptDate: new Date(receipt_date),
          amount,
          category,
          note: note || null,
          currency,
          status: 'completed',
          teamId: teamId || null,
        },
      });
    }

    // Increment usage counter
    await incrementUsage(userId, 'receipt_uploads');

    // Log the activity for admin tracking
    await logActivity(userId, EVENTS.RECEIPT_UPLOADED, {
      receipt_id: receipt.id,
      merchant_name,
      amount,
      category,
      team_id: teamId,
    });

    // Rewards: check first_upload mission + referral milestone (non-blocking)
    try {
      await checkAndCompleteMission(userId, 'first_upload');
      await triggerReferralMilestone(userId, 'FIRST_RECEIPT');
    } catch (rewardsError) {
      console.error('Rewards hook error:', rewardsError);
    }

    return NextResponse.json({ receipt }, { status: 201 });
  } catch (error) {
    console.error("POST /api/receipts error:", error);
    return handleDatabaseError(error);
  }
}
