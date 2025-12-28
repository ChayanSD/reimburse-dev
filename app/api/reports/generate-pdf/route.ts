import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { generatePDF } from "@/utils/pdfGenerator";
import prisma from "@/lib/prisma";
import { incrementUsage } from "@/lib/subscriptionGuard";

interface PDFGenerationRequestBody {
  reportId: number;
  userId: number;
  pdfData: any; // ExpenseReportData type
}

export const runtime = "nodejs";
export const maxDuration = 60;

async function handler(request: NextRequest): Promise<NextResponse> {
  let reportId: number | undefined;

  try {
    // Parse and validate request body
    const body: PDFGenerationRequestBody = await request.json();

    const { reportId: id, userId, pdfData } = body;

    if (!userId || !pdfData || !id) {
      console.error("Missing required fields:", { userId, reportId: id, hasPdfData: !!pdfData });
      return NextResponse.json(
        { error: "Missing required fields: userId, reportId, or pdfData" },
        { status: 400 }
      );
    }

    reportId = id;

    console.log(`Starting PDF generation for report ${reportId}`);

    // Update report status to processing
    await prisma.report.update({
      where: { id: reportId },
      data: {
        queueStatus: "processing",
        processingStarted: new Date(),
      },
    });

    // Generate PDF using PDFShift API
    const pdfResult = await generatePDF(pdfData, { userId: userId.toString() });

    // Update report with PDF URL and mark as completed
    await prisma.report.update({
      where: { id: reportId },
      data: {
        pdfUrl: pdfResult.pdf_url,
        queueStatus: "completed",
        processingEnded: new Date(),
      },
    });

    // Increment usage counter (only once PDF is successfully generated)
    await incrementUsage(userId, 'report_exports');

    console.log(`PDF generation completed for report ${reportId}`);

    return NextResponse.json({
      success: true,
      reportId,
      message: "PDF generated successfully",
      pdfUrl: pdfResult.pdf_url,
      filename: pdfResult.filename,
      pages: pdfResult.pages,
    });

  } catch (error) {
    console.error("PDF generation error:", {
      reportId,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update report to indicate failure
    if (reportId) {
      try {
        await prisma.report.update({
          where: { id: reportId },
          data: {
            queueStatus: "failed",
            processingEnded: new Date(),
            errorMessage: error instanceof Error ? error.message : "Unknown error",
          },
        });
        console.error(`Report ${reportId} PDF generation failed`);
      } catch (dbError) {
        console.error("Failed to update report:", {
          reportId,
          error: dbError instanceof Error ? dbError.message : "Unknown DB error",
        });
      }
    }

    return NextResponse.json(
      {
        error: "PDF generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
        reportId,
      },
      { status: 500 }
    );
  }
}

// Verify QStash signature for security
export const POST = verifySignatureAppRouter(handler);

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: "PDF Generator",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
}

