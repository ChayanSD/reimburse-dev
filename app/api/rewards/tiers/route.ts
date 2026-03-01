import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserTier } from "@/lib/rewards/tiers";

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const tier = await getUserTier(session.id);

        return NextResponse.json({ tier });
    } catch (error) {
        console.error("GET /api/rewards/tiers error:", error);
        return NextResponse.json({ error: "Failed to fetch tier" }, { status: 500 });
    }
}
