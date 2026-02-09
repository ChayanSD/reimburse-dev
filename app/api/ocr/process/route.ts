import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import {
  aiOCRExtraction,
  checkForDuplicate,
  normalizeCurrency,
  normalizeMerchant,
  parseDateRobust,
} from "@/lib/ocrProcessing";
import prisma from "@/lib/prisma";

interface ExtractedData {
  merchant_name: string;
  amount: number;
  category: string;
  receipt_date: string;
  confidence: string;
  date_source: string;
  extraction_notes?: string;
  currency?: string;
}

interface OCRRequestBody {
  receiptId?: number;
  userId: number;
  file_url: string;
  filename: string;
}

export const runtime = "nodejs";
export const maxDuration = 60; // Allow 60s for background processing

async function handler(request: NextRequest): Promise<NextResponse> {
  let receiptId: number | undefined;

  try {
    // Parse and validate request body
    const body: OCRRequestBody = await request.json();

    // Destructure with validation
    const { receiptId: id, userId, file_url, filename } = body;

    if (!userId || !file_url) {
      console.error("Missing required fields:", { userId, file_url });
      return NextResponse.json(
        { error: "Missing required fields: userId or file_url" },
        { status: 400 }
      );
    }

    receiptId = id;

    // Extract data using AI with timeout protection
    const extractedData = await Promise.race<ExtractedData>([
      aiOCRExtraction(file_url, filename, userId),
      new Promise<ExtractedData>((_, reject) =>
        setTimeout(() => reject(new Error("OCR timeout after 100 seconds")), 100 * 1000)
      ),
    ]);
    // Process and normalize data
    const merchant = normalizeMerchant(extractedData.merchant_name);
    const currency = normalizeCurrency(extractedData.amount.toString(), extractedData.currency);
    // Ensure date is always in YYYY-MM-DD format
    let date = parseDateRobust(extractedData.receipt_date);
    if (!date) {
      // If parsing fails, try to extract just the date part from ISO format
      const isoMatch = extractedData.receipt_date.match(/^(\d{4}-\d{2}-\d{2})/);
      date = isoMatch ? isoMatch[1] : new Date().toISOString().split("T")[0];
    }
    // Find or create receipt
    let receiptIdToUpdate = receiptId;
    if (!receiptId) {
      const existingReceipt = await prisma.receipt.findFirst({
        where: {
          userId,
          fileUrl: file_url,
          status: { in: ['pending', 'completed'] }
        },
      });
      if (existingReceipt) {
        receiptIdToUpdate = existingReceipt.id;
      } else {
        // Create new receipt
        const newReceipt = await prisma.receipt.create({
          data: {
            userId,
            fileName: filename,
            fileUrl: file_url,
            merchantName: merchant,
            amount: currency.amount,
            currency: currency.currency,
            receiptDate: new Date(date),
            category: extractedData.category,
            status: "completed",
            note: extractedData.extraction_notes || "Processed successfully",
          },
        });
        receiptIdToUpdate = newReceipt.id;
      }
    }

    // Check for duplicates
    const isDuplicate = await checkForDuplicate(
      userId,
      merchant,
      currency.amount,
      date
    );

    // Calculate confidence score
    const confidence =
      extractedData.confidence === "high" ? 0.9 :
        extractedData.confidence === "medium" ? 0.7 : 0.5;

    // Update receipt in database
    await prisma.receipt.update({
      where: { id: receiptIdToUpdate },
      data: {
        merchantName: merchant,
        amount: currency.amount,
        currency: currency.currency,
        receiptDate: new Date(date),
        category: extractedData.category,
        confidence,
        needsReview: confidence < 0.72,
        isDuplicate,
        status: "completed",
        note: extractedData.extraction_notes || "Processed successfully",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      receiptId: receiptIdToUpdate,
      data: {
        merchant,
        amount: currency.amount,
        currency: currency.currency,
        date,
        confidence,
      },
    });

  } catch (error) {
    console.error("OCR processing error:", {
      receiptId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (receiptId) {
      try {
        await prisma.receipt.update({
          where: { id: receiptId },
          data: {
            status: "failed",
            note: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"
              }`,
            updatedAt: new Date(),
          },
        });
        console.log("Receipt marked as failed:", receiptId);
      } catch (dbError) {
        console.error("Failed to update receipt status:", {
          receiptId,
          error: dbError instanceof Error ? dbError.message : "Unknown DB error",
        });
      }
    }

    // Return error response
    return NextResponse.json(
      {
        error: "OCR processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
        receiptId,
      },
      { status: 500 }
    );
  }
}

export const POST = verifySignatureAppRouter(handler);

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: "OCR Processor",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}