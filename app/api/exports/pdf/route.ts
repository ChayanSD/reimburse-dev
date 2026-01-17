import { generateReactPDF as generatePDF } from "@/utils/reactPdfGenerator";
import { ExpenseReportData } from "@/utils/htmlTemplates";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { safeJsonParse } from "@/utils/json";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";
import { subscriptionLimitReached } from "@/lib/error";

interface ExtractedData {
  merchant_name: string;
  amount: number;
  category: string;
  receipt_date: string;
  currency?: string;
}


export const maxDuration = 10;

const pdfRequestSchema = z.object({
  data: z.any(),
});

export async function GET() : Promise<NextResponse> {
  return NextResponse.json({
    message: "PDF Export API",
    usage: "POST JSON data with expense report to generate PDF",
    example: {
      data: {
        reportMeta: { report_id: "RPT-001", period_start: "2024-01-01", period_end: "2024-01-31", generated_at: new Date().toISOString() },
        submitter: { name: "John Doe", email: "john@example.com" },
        recipient: { company_name: "ABC Corp", approver_name: "Jane Smith", approver_email: "jane@abc.com" },
        summary: { total_reimbursable: 150.00, non_reimbursable: 0, totals_by_category: [] },
        line_items: []
      }
    }
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { batchSessionId } = body;

    let expenseData: ExpenseReportData;

    if (batchSessionId) {
      // Generate PDF from batch session - verify payment
      const batchSession = await prisma.batchSession.findFirst({
        where: {
          sessionId: batchSessionId,
          userId: session.id,
          paidAt: { not: null }, // Must be paid
        },
      });

      if (!batchSession) {
        return NextResponse.json(
          { error: "Batch session not found or payment not completed" },
          { status: 404 }
        );
      }

      // Get user info for PDF
      const user = await prisma.authUser.findUnique({
        where: { id: session.id },
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      });

      const files: Array<{
        id: string;
        url: string;
        name: string;
        status: string;
        extractedData?: ExtractedData;
      }> = safeJsonParse(batchSession.files, []);

      const completedFiles = files.filter(
        (file): file is typeof file & { extractedData: NonNullable<typeof file.extractedData> } =>
          file.status === "completed" && !!file.extractedData
      );

      // Calculate totals by category
      const categoryTotals: Record<string, number> = {};
      let totalAmount = 0;

      const lineItems = completedFiles.map((file, index) => {
        const amount = file.extractedData.amount;
        totalAmount += amount;
        categoryTotals[file.extractedData.category] = (categoryTotals[file.extractedData.category] || 0) + amount;

        return {
          date: file.extractedData.receipt_date,
          merchant: file.extractedData.merchant_name,
          description: `Receipt ${index + 1}`,
          category: file.extractedData.category,
          amount: amount,
          currency: file.extractedData.currency || "USD",
          file_url: file.url,
        };
      });

      const totalsByCategory = Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount,
      }));

      expenseData = {
        reportMeta: {
          report_id: `BATCH-${batchSessionId}`,
          period_start: completedFiles.length > 0 ? completedFiles[0].extractedData.receipt_date : new Date().toISOString().split('T')[0],
          period_end: completedFiles.length > 0 ? completedFiles[completedFiles.length - 1].extractedData.receipt_date : new Date().toISOString().split('T')[0],
          generated_at: new Date().toISOString(),
        },
        submitter: {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User',
          email: user?.email || session.email,
        },
        recipient: {
          company_name: "Batch Export",
          approver_name: "System",
          approver_email: "system@reimburseme.ai",
        },
        summary: {
          total_reimbursable: totalAmount,
          non_reimbursable: 0,
          totals_by_category: totalsByCategory,
        },
        line_items: lineItems,
      };
    } else {
      // Regular export - check subscription and validate request structure for custom data
      const subscriptionCheck = await checkSubscriptionLimit(session.id, 'report_exports');
      if (!subscriptionCheck.allowed) {
        return subscriptionLimitReached('Reports', 0, 0, '/plans');
      }

      const validation = pdfRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid request format", details: validation.error.issues },
          { status: 400 }
        );
      }

      expenseData = body.data as ExpenseReportData;
      
      // Increment usage for regular report export
      await incrementUsage(session.id, 'report_exports');
    }

    // Generate PDF
    const pdfResult = await generatePDF(expenseData);

    // Return PDF as attachment
    const filename = batchSessionId
      ? `batch-export-${batchSessionId}-${new Date().toISOString().split('T')[0]}.pdf`
      : pdfResult.filename;

    return new NextResponse(new Uint8Array(pdfResult.pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
