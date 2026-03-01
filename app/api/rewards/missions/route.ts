import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUserMissions } from "@/lib/rewards/missions";

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const missions = await getUserMissions(session.id);

        return NextResponse.json({ missions });
    } catch (error) {
        console.error("GET /api/rewards/missions error:", error);
        return NextResponse.json({ error: "Failed to fetch missions" }, { status: 500 });
    }
}
