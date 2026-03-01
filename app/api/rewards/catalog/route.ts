import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getRewardsCatalog } from "@/lib/rewards/redemptions";

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const rewards = await getRewardsCatalog(session.id);

        return NextResponse.json({ rewards });
    } catch (error) {
        console.error("GET /api/rewards/catalog error:", error);
        return NextResponse.json({ error: "Failed to fetch catalog" }, { status: 500 });
    }
}
