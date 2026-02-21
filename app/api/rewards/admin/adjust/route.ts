import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { adjustPoints } from "@/lib/rewards/points";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Admin only
        if (session.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { userId, points, note } = body;

        if (!userId || typeof userId !== "number") {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }
        if (!points || typeof points !== "number") {
            return NextResponse.json({ error: "points is required" }, { status: 400 });
        }
        if (!note || typeof note !== "string") {
            return NextResponse.json({ error: "note is required" }, { status: 400 });
        }

        const entry = await adjustPoints(userId, points, note, session.id);

        return NextResponse.json({
            success: true,
            entry,
            message: `${points > 0 ? "Added" : "Deducted"} ${Math.abs(points)} points`,
        });
    } catch (error) {
        console.error("POST /api/rewards/admin/adjust error:", error);
        return NextResponse.json({ error: "Adjustment failed" }, { status: 500 });
    }
}
