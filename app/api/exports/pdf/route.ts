import { generatePDF } from "@/utils/pdfGenerator";
import { ExpenseReportData } from "@/utils/htmlTemplates";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";


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
    const body = await request.json();

    // Validate request structure
    const validation = pdfRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request format", details: validation.error.issues },
        { status: 400 }
      );
    }

    const { data } = body;

    // Generate PDF
    const pdfResult = await generatePDF(data as ExpenseReportData);

    // Return PDF as attachment
    return new NextResponse(new Uint8Array(pdfResult.pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfResult.filename}"`,
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
