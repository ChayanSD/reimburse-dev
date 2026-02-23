import { getSession } from "@/lib/session";
import { unauthorized } from "@/lib/error";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { safeJsonParse } from "@/utils/json";
import { checkSubscriptionLimit, incrementUsage } from "@/lib/subscriptionGuard";
import { subscriptionLimitReached } from "@/lib/error";

const handleDatabaseError = (error: unknown) => {
  console.error("Database error:", error);
  return NextResponse.json({ error: "Database error" }, { status: 500 });
};

export const dynamic = 'force-dynamic';

interface ReceiptForCSV {
  id: number;
  receiptDate: Date;
  merchantName: string;
  category: string;
  amount: { toString(): string };
  currency: string;
  note: string | null;
  fileUrl: string;
  createdAt: Date;
}

interface BatchFile {
  id: string;
  url: string;
  name: string;
  status: string;
  extractedData?: {
    merchant_name: string;
    amount: number;
    category: string;
    receipt_date: string;
    currency?: string;
    extraction_notes?: string;
  };
}

function generateCSV(receipts: ReceiptForCSV[]): string {
  const headers = ["id", "date", "merchant", "category", "amount", "currency", "note", "file_url", "created_at"];

  const rows = receipts.map((receipt) => [
    receipt.id || "",
    receipt.receiptDate ? receipt.receiptDate.toISOString().split('T')[0] : "N/A",
    receipt.merchantName || "Unknown",
    receipt.category || "Other",
    receipt.amount ? receipt.amount.toString() : "0.00",
    receipt.currency || "USD",
    receipt.note || "",
    receipt.fileUrl || "",
    receipt.createdAt ? receipt.createdAt.toISOString() : "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return csvContent;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return unauthorized();
    }

    const userId = session.id;
    const { batchSessionId } = await request.json();

    let receipts;

    if (batchSessionId) {
      // Export from batch session - verify payment
      const batchSession = await prisma.batchSession.findFirst({
        where: {
          sessionId: batchSessionId,
          userId,
          paidAt: { not: null }, // Must be paid
        },
      });

      if (!batchSession) {
        return NextResponse.json(
          { error: "Batch session not found or payment not completed" },
          { status: 404 }
        );
      }

      // Convert batch session files to receipt-like format
      const files: BatchFile[] = safeJsonParse(batchSession.files, []);
      receipts = files
        .filter((file): file is BatchFile & { extractedData: NonNullable<BatchFile['extractedData']> } =>
          file.status === "completed" && !!file.extractedData
        )
        .map((file, index: number) => ({
          id: index + 1,
          receiptDate: new Date(file.extractedData.receipt_date),
          merchantName: file.extractedData.merchant_name,
          category: file.extractedData.category,
          amount: { toString: () => file.extractedData.amount.toString() },
          currency: file.extractedData.currency || "USD",
          note: file.extractedData.extraction_notes || null,
          fileUrl: file.url,
          createdAt: new Date(),
        }));
    } else {
      // Regular export - check subscription and fetch all receipts for the user
      const subscriptionCheck = await checkSubscriptionLimit(userId, 'report_exports');
      if (!subscriptionCheck.allowed) {
        return subscriptionLimitReached('Reports', 0, 0, '/plans');
      }

      receipts = await prisma.receipt.findMany({
        where: {
          userId,
        },
        orderBy: [
          { receiptDate: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      // Increment usage for regular report export
      await incrementUsage(userId, 'report_exports');
    }

    const csvContent = generateCSV(receipts);
    const filename = batchSessionId
      ? `batch-export-${batchSessionId}-${new Date().toISOString().split('T')[0]}.csv`
      : `reimburseme-data-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error("POST /api/exports/csv error:", error);
    return handleDatabaseError(error);
  }
}
