import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getReferralStats } from "@/lib/rewards/referrals";

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const stats = await getReferralStats(session.id);

        return NextResponse.json({ referral: stats });
    } catch (error) {
        console.error("GET /api/rewards/referral error:", error);
        return NextResponse.json({ error: "Failed to fetch referral info" }, { status: 500 });
    }
}
