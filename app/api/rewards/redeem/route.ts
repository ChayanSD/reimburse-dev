import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { redeemReward } from "@/lib/rewards/redemptions";

export async function POST(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { rewardId } = body;

        if (!rewardId || typeof rewardId !== "number") {
            return NextResponse.json({ error: "rewardId is required" }, { status: 400 });
        }

        const result = await redeemReward(session.id, rewardId);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            redemptionId: result.redemptionId,
            message: "Reward redeemed successfully",
        });
    } catch (error) {
        console.error("POST /api/rewards/redeem error:", error);
        return NextResponse.json({ error: "Redemption failed" }, { status: 500 });
    }
}
