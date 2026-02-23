import { NextRequest, NextResponse } from "next/server";
import { createUserCategory, getUserCategoriesWithStats } from "@/lib/categories";
import { getSession } from "@/lib/session";

// GET: Fetch all user categories with stats
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.id;
        const { searchParams } = new URL(request.url);
        const teamIdParam = searchParams.get("teamId");
        const teamId = teamIdParam ? parseInt(teamIdParam) : undefined;

        const categories = await getUserCategoriesWithStats(userId, teamId);
        return NextResponse.json({ categories });
    } catch (error) {
        console.error("Failed to fetch categories:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

// POST: Create a new category
async function postHandler(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.id;
        const body = await request.json();
        const { title, description } = body;

        if (!title) {
            return NextResponse.json({ error: "Missing title" }, { status: 400 });
        }

        const category = await createUserCategory(userId, { title, description });
        return NextResponse.json({ category, success: true });
    } catch (error) {
        console.error("Failed to create category:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export const POST = postHandler;

// DELETE: Remove a category
async function deleteHandler(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = session.id;
        const searchParams = request.nextUrl.searchParams;
        const categoryId = searchParams.get("categoryId");

        if (!categoryId) {
            return NextResponse.json({ error: "Missing categoryId" }, { status: 400 });
        }

        // Import dynamically to avoid circular deps if any (though unlikely here)
        // Actually importing at top level is fine as createUserCategory is there.
        // I need to import deleteUserCategory.
        const { deleteUserCategory } = await import("@/lib/categories");

        await deleteUserCategory(userId, categoryId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete category:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export const DELETE = deleteHandler;

