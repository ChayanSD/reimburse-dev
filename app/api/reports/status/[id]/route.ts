import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { unauthorized } from "@/lib/error";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const url = new URL(request.url);
    const reportID = url.pathname.split("/").pop();
    if (!reportID) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    const reportId = parseInt(reportID);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        userId: session.id,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Determine status based on PDF URL
    const status = report.pdfUrl ? "completed" : "processing";

    return NextResponse.json({
      success: true,
      status,
      report: {
        id: report.id,
        pdfUrl: report.pdfUrl,
        csvUrl: report.csvUrl,
        totalAmount: report.totalAmount,
        receiptCount: report.receiptCount,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}

