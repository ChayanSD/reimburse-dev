import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { ocrRequestSchema } from "@/validation/ocr.validation";
import { handleValidationError, badRequest, unauthorized } from "@/lib/error";
import { sanitizeUrl, sanitizeText } from "@/lib/sanitize";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";

export const runtime = "nodejs";
export const maxDuration = 10; // Vercel serverless function timeout

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const userId = session.id;
    const body = await request.json();

    // Validate input
    const validation = ocrRequestSchema.safeParse(body);
    if (!validation.success) return handleValidationError(validation.error);

    const { file_url, filename } = validation.data;

    // Check subscription limits for OCR processing (receipt uploads)
    const subscriptionCheck = await checkSubscriptionLimit(userId, 'receipt_uploads');
    if (!subscriptionCheck.allowed) {
      return NextResponse.json({
        error: subscriptionCheck.reason || 'Subscription limit reached',
        upgradeRequired: subscriptionCheck.upgradeRequired,
        currentTier: subscriptionCheck.currentTier,
      }, { status: 402 });
    }

    // Sanitize inputs
    const sanitizedFileUrl = sanitizeUrl(file_url);
    const sanitizedFilename = sanitizeText(filename || "");
    if (!sanitizedFileUrl) return badRequest("Invalid file URL provided");

    // Check cache for existing OCR result
    const cacheKey = `ocr:${userId}:${sanitizedFileUrl}`;
    const cachedResult = await redis.get(cacheKey);

    if (cachedResult) {
      console.log("Using cached OCR result for:", sanitizedFileUrl);
      const parsedCache = JSON.parse(cachedResult as string);

      // Create receipt record with cached data
      const receipt = await prisma.receipt.create({
        data: {
          userId,
          merchantName: parsedCache.merchant_name,
          amount: parsedCache.amount,
          currency: parsedCache.currency,
          receiptDate: new Date(parsedCache.receipt_date.split('T')[0] || parsedCache.receipt_date),
          status: "completed",
          fileUrl: sanitizedFileUrl,
          fileName: sanitizedFilename,
          category: parsedCache.category,
          confidence: parsedCache.confidence,
          needsReview: parsedCache.needs_review,
          isDuplicate: parsedCache.is_duplicate,
          note: parsedCache.extraction_notes,
        },
      });

      // Increment usage counter for cached OCR result
      await incrementUsage(userId, 'receipt_uploads');

      return NextResponse.json({
        success: true,
        receipt_id: receipt.id,
        status: "completed",
        message: "Receipt processed from cache",
        extracted_data: parsedCache,
      });
    }

    // Create pending receipt record
    const receipt = await prisma.receipt.create({
      data: {
        userId,
        merchantName: "Processing...",
        amount: 0,
        receiptDate: new Date(),
        status: "pending",
        fileUrl: sanitizedFileUrl,
        fileName: sanitizedFilename,
        category: "Other",
      },
    });

    // Queue the OCR processing job with QStash
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ocr/process`;

    await qstashClient.publishJSON({
      url: webhookUrl,
      body: {
        receiptId: receipt.id,
        userId,
        file_url: sanitizedFileUrl,
        filename: sanitizedFilename,
      },
      retries: 2,
      timeout: "60s",
    });

    // Return immediately with receipt ID
    return NextResponse.json({
      success: true,
      receipt_id: receipt.id,
      status: "processing",
      message: "Receipt queued for processing",
    });
  } catch (error) {
    console.error("POST /api/ocr error:", error);
    return NextResponse.json(
      { error: "Failed to queue OCR processing" },
      { status: 500 }
    );
  }
}
