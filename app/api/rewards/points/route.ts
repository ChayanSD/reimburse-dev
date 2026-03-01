import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getPointsBalance, getPointsHistory } from "@/lib/rewards/points";

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");

        const [balance, history] = await Promise.all([
            getPointsBalance(session.id),
            getPointsHistory(session.id, page, limit),
        ]);

        return NextResponse.json({
            balance,
            history: history.entries,
            totalEntries: history.total,
            page,
            limit,
        });
    } catch (error) {
        console.error("GET /api/rewards/points error:", error);
        return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 });
    }
}
