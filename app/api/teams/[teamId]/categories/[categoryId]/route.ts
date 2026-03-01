import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { getTeamMember } from "@/lib/permissions";
import { deleteUserCategory } from "@/lib/categories";

// DELETE /api/teams/[teamId]/categories/[categoryId] - Delete team category
export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ teamId: string; categoryId: string }> }
) {
    const { teamId, categoryId } = await context.params;
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tid = parseInt(teamId);
    if (isNaN(tid)) {
        return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    try {
        await deleteUserCategory(session.id, categoryId, tid);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE /api/teams/[teamId]/categories/[categoryId] error:", error);
        if (error.message === "Category not found") {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message.includes("Forbidden") || error.message.includes("Access denied")) {
            return NextResponse.json({ error: error.message }, { status: 403 });
        }
        return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
    }
}
