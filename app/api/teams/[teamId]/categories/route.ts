import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { can, getTeamMember } from "@/lib/permissions";
import { createUserCategory, getUserCategoriesWithStats } from "@/lib/categories";

const createCategorySchema = z.object({
    title: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
});

// GET /api/teams/[teamId]/categories - List team categories
export async function GET(
    req: NextRequest,
    context: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await context.params;
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tid = parseInt(teamId);
    if (isNaN(tid)) {
        return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const member = await getTeamMember(session.id, tid);
    if (!member) {
        return NextResponse.json({ error: "Team not found or access denied" }, { status: 404 });
    }

    try {
        const categories = await getUserCategoriesWithStats(session.id, tid);
        return NextResponse.json({ categories });
    } catch (error) {
        console.error("GET /api/teams/[teamId]/categories error:", error);
        return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
    }
}

// POST /api/teams/[teamId]/categories - Create team category
export async function POST(
    req: NextRequest,
    context: { params: Promise<{ teamId: string }> }
) {
    const { teamId } = await context.params;
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tid = parseInt(teamId);
    if (isNaN(tid)) {
        return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const member = await getTeamMember(session.id, tid);
    // Allow OWNER and ADMIN to create categories
    if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
        return NextResponse.json({ error: "Forbidden - Only team admins can create categories" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const validated = createCategorySchema.parse(body);

        const category = await createUserCategory(session.id, {
            title: validated.title,
            description: validated.description,
            teamId: tid,
        });

        return NextResponse.json({ category }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/teams/[teamId]/categories error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
    }
}
