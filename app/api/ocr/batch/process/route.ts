import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { aiOCRExtraction } from "@/lib/ocrProcessing";
import { safeJsonParse } from "@/utils/json";

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

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { batchSessionId, fileIndex, userId, file_url, filename } = body;

    if (!batchSessionId || fileIndex === undefined || !userId || !file_url || !filename) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Process the OCR outside the DB transaction (slow phase)
    try {
      const extractedData = await aiOCRExtraction(file_url, filename, userId);

      // Perform atomic update within a transaction to avoid race conditions
      await prisma.$transaction(async (tx: any) => {
        const currentSessions = await tx.$queryRaw`
          SELECT files, status FROM batch_sessions WHERE id = ${batchSessionId} FOR UPDATE
        `;

        const currentSession = (currentSessions as any[])[0];
        if (!currentSession) throw new Error("Batch session disappeared during processing");

        const currentFiles: Array<{
          id: string;
          url: string;
          name: string;
          status: string;
          extractedData?: ExtractedData;
        }> = safeJsonParse(currentSession.files, []);

        currentFiles[fileIndex] = {
          ...currentFiles[fileIndex],
          status: "completed",
          extractedData,
        };

        const allDone = currentFiles.every((file) => file.status === "completed" || file.status === "failed");
        const hasFailures = currentFiles.some((file) => file.status === "failed");

        let newStatus = "processing";
        if (allDone) {
          newStatus = hasFailures ? "failed" : "completed";
        }

        await tx.batchSession.update({
          where: { id: batchSessionId },
          data: {
            files: currentFiles as any,
            status: newStatus,
          },
        });
      });

      return NextResponse.json({
        success: true,
        extractedData,
      });
    } catch (ocrError) {
      console.error("OCR processing error:", ocrError);

      try {
        await prisma.$transaction(async (tx: any) => {
          const currentSessions = await tx.$queryRaw`
            SELECT files, status FROM batch_sessions WHERE id = ${batchSessionId} FOR UPDATE
          `;
          const currentSession = (currentSessions as any[])[0];
          if (!currentSession) return;

          const currentFiles: Array<{
            id: string;
            url: string;
            name: string;
            status: string;
            extractedData?: ExtractedData;
          }> = safeJsonParse(currentSession.files, []);

          currentFiles[fileIndex] = {
            ...currentFiles[fileIndex],
            status: "failed",
          };

          const allDone = currentFiles.every((file) => file.status === "completed" || file.status === "failed");
          const hasFailures = currentFiles.some((file) => file.status === "failed");
          const newStatus = allDone ? (hasFailures ? "failed" : "completed") : "processing";

          await tx.batchSession.update({
            where: { id: batchSessionId },
            data: {
              files: currentFiles as any,
              status: newStatus,
            },
          });
        });
      } catch (dbError) {
        console.error("Failed to update failure status:", dbError);
      }

      return NextResponse.json({
        error: "OCR processing failed",
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Batch process error:", error);
    return NextResponse.json(
      { error: "Failed to process batch file" },
      { status: 500 }
    );
  }
}