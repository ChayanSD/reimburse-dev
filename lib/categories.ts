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
    title: string,
    description?: string
) {
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
export async function getUserCategoriesWithStats(userId: number): Promise<UserCategoryData[]> {
    const categories = await prisma.userCategory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });

    const stats = await prisma.receipt.groupBy({
        by: ['category'],
        where: { userId },
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
export async function deleteUserCategory(userId: number, categoryId: string) {
    // Check ownership
    const category = await prisma.userCategory.findUnique({
        where: { id: categoryId },
    });

    if (!category || category.userId !== userId) {
        throw new Error("Category not found or access denied");
    }

    return prisma.userCategory.delete({
        where: { id: categoryId },
    });
}

/**
 * Lightweight fetcher for AI prompt generation.
 */
export async function getUserCategoriesForAI(userId: number) {
    return prisma.userCategory.findMany({
        where: { userId },
        select: { title: true, description: true },
    });
}
