import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";
import { unauthorized } from "@/lib/error";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return unauthorized();
    }

    const userId = session.id;
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json(
        { error: "reportId parameter is required" },
        { status: 400 }
      );
    }

    // Get the specific report
    const report = await prisma.report.findFirst({
      where: {
        id: parseInt(reportId),
        userId: userId,
      },
      select: {
        id: true,
        queueStatus: true,
        queuePosition: true,
        estimatedTime: true,
        processingStarted: true,
        processingEnded: true,
        errorMessage: true,
        pdfUrl: true,
        createdAt: true,
      },
    });

    if (!report) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    // Calculate queue position and estimated time if still queued
    let queueInfo = null;
    if (report.queueStatus === 'queued') {
      // Count reports ahead in queue for this user
      const aheadInQueue = await prisma.report.count({
        where: {
          userId: userId,
          queueStatus: 'queued',
          createdAt: {
            lt: report.createdAt,
          },
        },
      });

      // Estimate time based on position (rough estimate: 30 seconds per report)
      const estimatedTimeSeconds = (aheadInQueue + 1) * 30;

      queueInfo = {
        position: aheadInQueue + 1,
        estimatedTimeSeconds,
        estimatedTimeFormatted: formatTime(estimatedTimeSeconds),
      };

      // Update the report with queue position
      await prisma.report.update({
        where: { id: report.id },
        data: {
          queuePosition: aheadInQueue + 1,
          estimatedTime: estimatedTimeSeconds,
        },
      });
    }

    return NextResponse.json({
      report: {
        ...report,
        queueInfo,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/queue-status error:", error);
    return NextResponse.json(
      { error: "Failed to get queue status" },
      { status: 500 }
    );
  }
}

function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}${remainingSeconds > 0 ? ` ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}` : ''}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours} hour${hours !== 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : ''}`;
}