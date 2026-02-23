import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { adjustPoints } from "@/lib/rewards/points";
import prisma from "@/lib/prisma";

const adjustSchema = z.object({
    userId: z.number().int().positive(),
    points: z.number().int().positive({ message: "Points must be a positive number" }),
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

        // Fetch updated balance for email
        const { getPointsBalance } = await import("@/lib/rewards/points");
        const balance = await getPointsBalance(userId);

        // Send notification email
        const { sendPointsAdjustmentEmail } = await import("@/lib/emailService");
        await sendPointsAdjustmentEmail({
            to: user.email,
            points,
            newBalance: balance.available,
            reason: note
        });

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
        const search = searchParams.get("search");

        if (!userId && !search) {
            return NextResponse.json({ error: "userId or search term is required" }, { status: 400 });
        }

        // If searching by name/email
        if (search) {
            const users = await prisma.authUser.findMany({
                where: {
                    OR: [
                        { email: { contains: search, mode: 'insensitive' } },
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } }
                    ]
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                },
                take: 5
            });
            return NextResponse.json({ users });
        }

        const { getPointsBalance, getPointsHistory } = await import("@/lib/rewards/points");
        const { getUserTier } = await import("@/lib/rewards/tiers");

        const user = await prisma.authUser.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, lastName: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const [balance, tier, historyResult] = await Promise.all([
            getPointsBalance(userId),
            getUserTier(userId),
            getPointsHistory(userId, 1, 10),
        ]);

        return NextResponse.json({
            userId,
            user,
            balance,
            tier,
            recentHistory: historyResult.entries,
        });
    } catch (error) {
        console.error("GET /api/admin/rewards/adjust-points error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
