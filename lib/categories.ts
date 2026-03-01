import prisma from "@/lib/prisma";
import OpenAI from "openai";
import { withKeyProtection } from "@/lib/security";

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export interface UserCategoryData {
    id: string;
    title: string;
    description: string | null;
    receiptCount: number;
    totalSpend: number;
}

export async function createUserCategory(
    userId: number,
    itemData: { title: string; description?: string; teamId?: number }
) {
    const { title, description, teamId } = itemData;
    return withKeyProtection(
        "openai",
        "category_generation",
        async () => {
            // 1. Generate AI Profile
            const aiResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: `You are a categorization expert. 
          Generate a list of 5-10 specific keywords and synonyms for the given category title and description to help match receipts.
          Return ONLY a JSON array of strings. Example: ["conference", "workshop", "seminar", "training", "education"]`
                    },
                    {
                        role: "user",
                        content: `Category: ${title}. Description: ${description || "General expense category"}`
                    }
                ],
                response_format: { type: "json_object" }
            });

            const content = aiResponse.choices[0].message.content;
            const keywords = content ? JSON.parse(content).keywords || JSON.parse(content) : [];

            // Ensure keywords is an array of strings
            const validKeywords = Array.isArray(keywords) ? keywords : [];

            // 2. Generate Embedding (for semantic search if needed later)
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: `${title} ${description || ""} ${validKeywords.join(" ")}`,
            });

            const embedding = embeddingResponse.data[0].embedding;

            // 3. Save to DB
            const category = await prisma.userCategory.create({
                data: {
                    userId,
                    teamId: teamId || null,
                    title,
                    description,
                    keywords: validKeywords,
                    embedding: embedding,
                },
            });

            return category;
        },
        { userId }
    );
}

/**
 * Fetches user categories with aggregate usage stats.
 */
export async function getUserCategoriesWithStats(userId: number, teamId?: number): Promise<UserCategoryData[]> {
    const where: any = { userId };
    if (teamId) {
        where.teamId = teamId;
    } else {
        where.teamId = null;
    }

    const categories = await prisma.userCategory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });

    const receiptWhere: any = { userId };
    if (teamId) {
        receiptWhere.teamId = teamId;
    } else {
        receiptWhere.teamId = null;
    }

    const stats = await prisma.receipt.groupBy({
        by: ['category'],
        where: receiptWhere,
        _count: {
            id: true,
        },
        _sum: {
            amount: true,
        },
    });

    const categoryStats = new Map<string, { count: number; sum: number }>();
    stats.forEach((stat) => {
        if (stat.category) {
            categoryStats.set(stat.category, {
                count: stat._count.id,
                sum: stat._sum.amount ? Number(stat._sum.amount) : 0,
            });
        }
    });

    return categories.map((cat: { id: string; title: string; description: string | null }) => {
        const stat = categoryStats.get(cat.title) || { count: 0, sum: 0 };
        return {
            id: cat.id,
            title: cat.title,
            description: cat.description,
            receiptCount: stat.count,
            totalSpend: stat.sum,
        };
    });
}

/**
 * Deletes a user category.
 */
export async function deleteUserCategory(userId: number, categoryId: string, teamId?: number) {
    // Check ownership or team admin rights
    const category = await prisma.userCategory.findUnique({
        where: { id: categoryId },
    });

    if (!category) {
        throw new Error("Category not found");
    }

    // Allow if:
    // 1. It's a personal category and user owns it
    // 2. It's a team category and user is an admin/owner of that team
    if (category.teamId && teamId) {
        if (category.teamId !== teamId) {
            throw new Error("Category does not belong to this team");
        }

        const member = await prisma.teamMember.findUnique({
            where: { teamId_userId: { teamId, userId } },
        });

        if (!member || !["OWNER", "ADMIN"].includes(member.role)) {
            throw new Error("Forbidden - Only team admins can delete team categories");
        }
    } else if (category.userId !== userId) {
        throw new Error("Access denied - You do not own this category");
    }

    return prisma.userCategory.delete({
        where: { id: categoryId },
    });
}

/**
 * Lightweight fetcher for AI prompt generation.
 */
export async function getUserCategoriesForAI(userId: number, teamId?: number) {
    const where: any = { userId };
    if (teamId) {
        where.teamId = teamId;
    } else {
        where.teamId = null;
    }
    return prisma.userCategory.findMany({
        where,
        select: { title: true, description: true },
    });
}

/**
 * Fetch team categories specifically.
 */
export async function getTeamCategoriesForAI(teamId: number) {
    return prisma.userCategory.findMany({
        where: { teamId },
        select: { title: true, description: true },
    });
}
