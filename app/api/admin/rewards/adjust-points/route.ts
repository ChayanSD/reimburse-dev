import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { adjustPoints } from "@/lib/rewards/points";
import prisma from "@/lib/prisma";

const adjustSchema = z.object({
    userId: z.number().int().positive(),
    points: z.number().int().refine((v) => v !== 0, { message: "Points cannot be zero" }),
    note: z.string().min(3).max(500),
});

/**
 * POST /api/admin/rewards/adjust-points
 * Admin-only endpoint to manually credit or debit points for a user.
 * Body: { userId: number, points: number (positive = credit, negative = debit), note: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session || session.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validation = adjustSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json(
                { error: "Validation failed", details: validation.error.issues },
                { status: 400 }
            );
        }

        const { userId, points, note } = validation.data;

        // Ensure user exists
        const user = await prisma.authUser.findUnique({
            where: { id: userId },
            select: { id: true, email: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const entry = await adjustPoints(userId, points, note, session.id);

        return NextResponse.json({
            success: true,
            entry,
            message: `Adjusted ${points > 0 ? "+" : ""}${points} points for ${user.email}`,
        });
    } catch (error) {
        console.error("POST /api/admin/rewards/adjust-points error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * GET /api/admin/rewards/adjust-points?userId=123
 * Returns current balance for a given user (admin only).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session || session.role !== "ADMIN") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userId = parseInt(searchParams.get("userId") || "0");

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        const { getPointsBalance, getPointsHistory } = await import("@/lib/rewards/points");
        const { getUserTier } = await import("@/lib/rewards/tiers");

        const [balance, tier, historyResult] = await Promise.all([
            getPointsBalance(userId),
            getUserTier(userId),
            getPointsHistory(userId, 1, 10),
        ]);

        return NextResponse.json({
            userId,
            balance,
            tier,
            recentHistory: historyResult.entries,
        });
    } catch (error) {
        console.error("GET /api/admin/rewards/adjust-points error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
