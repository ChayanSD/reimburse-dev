import { NextRequest, NextResponse } from "next/server";
import { reportCreateSchema } from "@/validation/report.validation";
import { badRequest, unauthorized, notFound, handleValidationError } from "@/lib/error";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AuthUser, CompanySettings, Receipt } from "@/app/generated/prisma/client";
// import type { AuthUser, CompanySettings, Receipt } from "../../generated/prisma/client";

// Fast endpoint - just returns PDF data structure (no PDF generation)
// Used for client-side PDF generation
export const maxDuration = 10;

function convertToPDFFormat(
  receipts: Receipt[],
  periodStart: string,
  totalAmount: number,
  user: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName'>,
  companySetting: CompanySettings | null = null,
  periodEnd: string | null = null,
  title: string | null = null,
) {
  const startDate = periodStart || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = periodEnd || new Date(
    new Date(startDate).getFullYear(),
    new Date(startDate).getMonth() + 1,
    0,
  ).toISOString().split("T")[0];

  const categoryTotals = receipts.reduce((acc: Record<string, number>, receipt) => {
    const category = receipt.category || "Other";
    acc[category] = (acc[category] || 0) + receipt.amount.toNumber();
    return acc;
  }, {});

  let address_lines = ["123 Business St", "City, State 12345"];
  if (companySetting) {
    address_lines = [];
    if (companySetting.addressLine1)
      address_lines.push(companySetting.addressLine1);
    if (companySetting.addressLine2)
      address_lines.push(companySetting.addressLine2);

    const locationParts = [];
    if (companySetting.city) locationParts.push(companySetting.city);
    if (companySetting.state) locationParts.push(companySetting.state);
    if (companySetting.zipCode) locationParts.push(companySetting.zipCode);
    if (locationParts.length > 0) {
      address_lines.push(locationParts.join(", "));
    }

    if (companySetting.country && companySetting.country !== "United States") {
      address_lines.push(companySetting.country);
    }

    if (address_lines.length === 0) {
      address_lines.push("Address not provided");
    }
  }

  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "User";

  const reportId = `RPT-${startDate.replace(/-/g, "").substring(0, 6)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

  return {
    reportMeta: {
      period_start: startDate,
      period_end: endDate,
      generated_at: new Date().toISOString(),
      report_id: reportId,
      timezone: "America/Chicago",
      locale: "en-US",
      currency: "USD",
    },
    submitter: {
      name: fullName,
      email: user.email,
      title: "Employee",
      department: companySetting?.department || "General",
      employee_id: `EMP-${user.id}`,
    },
    recipient: {
      company_name: companySetting?.companyName || "Company Name",
      approver_name: companySetting?.approverName || "Manager",
      approver_email: companySetting?.approverEmail || "manager@company.com",
      address_lines: address_lines,
    },
    branding: {
      primary_color: "#2E86DE",
      accent_color: "#10B981",
      neutral_bg: "#F7F8FA",
      font_heading: "Poppins",
      font_body: "Inter",
      template: "Classic",
    },
    policy: {
      title: "Expense Reimbursement Policy",
      notes: companySetting?.notes
        ? [companySetting.notes]
        : [
            "Submit receipts within 30 days",
            "Business expenses only",
            "Approval required for amounts over $100",
          ],
      violations: [],
    },
    summary: {
      totals_by_category: Object.entries(categoryTotals).map(
        ([category, amount]) => ({
          category,
          amount: amount,
        }),
      ),
      total_reimbursable: totalAmount,
      non_reimbursable: 0.0,
      per_diem_days: 0,
      per_diem_rate: 0.0,
      tax: 0.0,
    },
    line_items: receipts.map((receipt) => ({
      receipt_id: receipt.id,
      date: receipt.receiptDate.toISOString().split('T')[0],
      merchant: receipt.merchantName || "Unknown",
      category: receipt.category || "Other",
      amount: receipt.amount.toNumber(),
      currency: receipt.currency || "USD",
      converted_amount: receipt.amount.toNumber(),
      project_code: companySetting?.costCenter || null,
      notes: receipt.note || `Receipt from ${receipt.receiptDate.toISOString().split('T')[0] || "unknown date"}`,
      policy_flag: false,
      file_url: receipt.fileUrl,
    })),
    appendix: {
      include_receipt_gallery: false,
      receipt_images: [],
    },
    signoff: {
      submitter_signature_text: "I certify that these expenses are accurate and incurred for work-related purposes. I understand that any false or misleading information may result in disciplinary action.",
      approver_signature_placeholder: true,
    },
    title: title || `Expense Report - ${startDate} to ${endDate}`,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const userId = session.id;
    const body = await request.json();

    const validation = reportCreateSchema.safeParse(body);
    if (!validation.success) {
      return handleValidationError(validation.error);
    }

    const { receipt_ids, period_start, period_end, title, company_setting_id } = validation.data;

    const user = await prisma.authUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    if (!user) {
      return notFound("User not found");
    }

    const receipts = await prisma.receipt.findMany({
      where: {
        userId: userId,
        id: { in: receipt_ids },
        receiptDate: {
          gte: new Date(period_start),
          lte: new Date(period_end)
        }
      },
      orderBy: { receiptDate: 'desc' }
    });

    if (receipts.length === 0) {
      return badRequest("No receipts found for the selected period");
    }

    let companySetting = null;
    if (company_setting_id !== null && company_setting_id !== undefined) {
      companySetting = await prisma.companySettings.findUnique({
        where: { id: company_setting_id, userId: userId }
      });
    }

    if (!companySetting) {
      companySetting = await prisma.companySettings.findFirst({
        where: { userId: userId, isDefault: true }
      });
    }

    if (!companySetting) {
      companySetting = await prisma.companySettings.findFirst({
        where: { userId: userId }
      });
    }

    const totalAmount = receipts.reduce(
      (sum, receipt) => sum + receipt.amount.toNumber(),
      0,
    );

    const pdfData = convertToPDFFormat(
      receipts,
      period_start,
      totalAmount,
      user,
      companySetting,
      period_end,
      title
    );

    // Generate filename
    const userSlug = user.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const periodStart = new Date(period_start);
    const periodStr = `${periodStart.getFullYear()}-${String(
      periodStart.getMonth() + 1
    ).padStart(2, "0")}`;
    const filename = `reimburseme_${userSlug}_${periodStr}.pdf`;

    return NextResponse.json({
      success: true,
      pdfData,
      filename,
      total_amount: totalAmount,
      receipt_count: receipts.length,
    });
  } catch (error) {
    console.error("PDF data generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF data" },
      { status: 500 }
    );
  }
}

