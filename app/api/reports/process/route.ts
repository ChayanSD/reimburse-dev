import { NextRequest, NextResponse } from "next/server";
import { generatePDF } from "@/utils/pdfGenerator";
import { ExpenseReportData } from "@/utils/htmlTemplates";
import prisma from "@/lib/prisma";

// Background processing route - called by QStash
// Has 60s timeout (enough for PDF generation)
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  let reportId: number | null = null;
  
  try {
    // Log incoming request for debugging
    console.log("[PDF Process] Received background job request");
    console.log("[PDF Process] Headers:", Object.fromEntries(request.headers.entries()));
    
    const body = await request.json();
    const { reportId: id, pdfData, userId } = body;

    console.log("[PDF Process] Report ID:", id);
    console.log("[PDF Process] User ID:", userId);
    console.log("[PDF Process] PDF Data present:", !!pdfData);

    if (!id || !pdfData || !userId) {
      console.error("[PDF Process] Missing required fields:", { id: !!id, pdfData: !!pdfData, userId: !!userId });
      return NextResponse.json(
        { error: "Missing required fields: reportId, pdfData, or userId" },
        { status: 400 }
      );
    }

    reportId = id;

    // Find the report
    const report = await prisma.report.findUnique({
      where: { id: reportId as number },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Generate PDF (no timeout issues here - 60s available)
    console.log("[PDF Process] Starting PDF generation...");
    const pdfResult = await generatePDF(pdfData as ExpenseReportData, {
      userId: userId.toString(),
    });
    console.log("[PDF Process] PDF generated successfully, size:", pdfResult.pdfBuffer.length, "bytes");

    // Update report with PDF URL
    console.log("[PDF Process] Updating report in database...");
    await prisma.report.update({
      where: { id: reportId as number },
      data: {
        pdfUrl: pdfResult.pdf_url,
      },
    });
    console.log("[PDF Process] Report updated successfully");

    return NextResponse.json({
      success: true,
      reportId,
      pdfUrl: pdfResult.pdf_url,
      filename: pdfResult.filename,
    });
  } catch (error) {
    console.error("PDF processing error:", error);
    
    // Update report status to failed (if we have reportId)
    if (reportId) {
      try {
        await prisma.report.update({
          where: { id: reportId },
          data: {
            pdfUrl: null,
          },
        });
      } catch (updateError) {
        console.error("Failed to update report status:", updateError);
      }
    }

    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

