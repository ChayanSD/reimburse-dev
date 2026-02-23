import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";
import { batchOcrRequestSchema } from "@/validation/ocr.validation";
import { handleValidationError, badRequest, unauthorized } from "@/lib/error";
import { sanitizeUrl, sanitizeText } from "@/lib/sanitize";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";
import { randomUUID } from "crypto";
import { safeJsonParse } from "@/utils/json";

export const runtime = "nodejs";
export const maxDuration = 10;

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
    const validation = batchOcrRequestSchema.safeParse(body);
    if (!validation.success) return handleValidationError(validation.error);

    const { files, teamId } = validation.data;

    // NOTE: Batch sessions are exempted from regular subscription limits because
    // they require a one-time payment ($4) for export.
    if (files.length > 10) {
      return badRequest("Maximum 10 files allowed per batch session.");
    }

    // Sanitize inputs
    const sanitizedFiles = files.map(file => ({
      url: sanitizeUrl(file.url),
      name: sanitizeText(file.name || ""),
    }));

    if (sanitizedFiles.some(file => !file.url)) {
      return badRequest("Invalid file URLs provided");
    }

    // Generate unique session ID
    const sessionId = randomUUID();

    // Create batch session record
    const batchSession = await prisma.batchSession.create({
      data: {
        userId,
        sessionId,
        files: sanitizedFiles.map((file, index) => ({
          id: `file-${index}`,
          url: file.url,
          name: file.name,
          status: "pending",
        })),
        status: "processing",
      },
    });

    // Queue individual OCR jobs for each file
    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/ocr/batch/process`;

    for (let i = 0; i < sanitizedFiles.length; i++) {
      const file = sanitizedFiles[i];

      await qstashClient.publishJSON({
        url: webhookUrl,
        body: {
          batchSessionId: batchSession.id,
          fileIndex: i,
          userId,
          teamId,
          file_url: file.url,
          filename: file.name,
        },
        retries: 2,
        timeout: "60s",
      });
    }

    // Increment usage counter for all files
    await incrementUsage(userId, 'receipt_uploads', files.length);

    return NextResponse.json({
      success: true,
      batchSession: {
        id: batchSession.id,
        sessionId: batchSession.sessionId,
        status: batchSession.status,
        files: safeJsonParse(batchSession.files, []),
      },
      message: "Batch processing queued successfully",
    });
  } catch (error) {
    console.error("POST /api/ocr/batch error:", error);
    return NextResponse.json(
      { error: "Failed to queue batch processing" },
      { status: 500 }
    );
  }
}