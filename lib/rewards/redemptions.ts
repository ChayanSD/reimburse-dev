import prisma from "@/lib/prisma";
import { spendPoints } from "./points";
import { getUserTier } from "./tiers";
import { getStripeInstance } from "@/lib/stripe";

// ── Types ──────────────────────────────────────────────────

export interface RewardItem {
    id: number;
    title: string;
    description: string | null;
    pointsCost: number;
    rewardType: string;
    rewardValue: Record<string, unknown>;
    minTier: number;
    sortOrder: number;
    canRedeem: boolean;
}

export interface RedemptionResult {
    success: boolean;
    redemptionId?: number;
    error?: string;
}

// ── Catalog ────────────────────────────────────────────────

/**
 * Get available rewards filtered by user's tier.
 */
export async function getRewardsCatalog(userId: number): Promise<RewardItem[]> {
    const [rewards, tier, balance] = await Promise.all([
        prisma.rewardsCatalog.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
        }),
        getUserTier(userId),
        (await import("./points")).getAvailableBalance(userId),
    ]);

    return rewards.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        pointsCost: r.pointsCost,
        rewardType: r.rewardType,
        rewardValue: r.rewardValue as Record<string, unknown>,
        minTier: r.minTier,
        sortOrder: r.sortOrder,
        canRedeem: tier.level >= r.minTier && balance >= r.pointsCost,
    }));
}

// ── Redemption ─────────────────────────────────────────────

/**
 * Redeem a reward.
 * 1. Validate balance + tier
 * 2. Create redemption record
 * 3. Deduct points
 * 4. Fulfill reward
 */
export async function redeemReward(
    userId: number,
    rewardId: number
): Promise<RedemptionResult> {
    try {
        // Get reward
        const reward = await prisma.rewardsCatalog.findUnique({
            where: { id: rewardId },
        });

        if (!reward || !reward.isActive) {
            return { success: false, error: "Reward not found or inactive" };
        }

        // Check tier
        const tier = await getUserTier(userId);
        if (tier.level < reward.minTier) {
            return { success: false, error: `Requires tier level ${reward.minTier}` };
        }

        // Spend points (will throw if insufficient)
        try {
            await spendPoints(userId, reward.pointsCost, "redemption", String(rewardId));
        } catch {
            return { success: false, error: "Insufficient points" };
        }

        // Create redemption record
        const redemption = await prisma.redemption.create({
            data: {
                userId,
                rewardId,
                pointsSpent: reward.pointsCost,
                status: "pending",
            },
        });

        // Fulfill reward
        try {
            await fulfillReward(userId, redemption.id, reward.rewardType, reward.rewardValue as Record<string, unknown>);
            return { success: true, redemptionId: redemption.id };
        } catch (error) {
            console.error("Reward fulfillment failed:", error);
            // Mark as failed but don't refund yet (manual review)
            await prisma.redemption.update({
                where: { id: redemption.id },
                data: { status: "failed" },
            });
            return { success: false, error: "Fulfillment failed, points held for review" };
        }
    } catch (error) {
        console.error("Redemption error:", error);
        return { success: false, error: "Redemption failed" };
    }
}

// ── Fulfillment ────────────────────────────────────────────

async function fulfillReward(
    userId: number,
    redemptionId: number,
    rewardType: string,
    rewardValue: Record<string, unknown>
): Promise<void> {
    switch (rewardType) {
        case "stripe_credit":
            await fulfillStripeCredit(userId, redemptionId, rewardValue);
            break;
        case "free_months":
            await fulfillFreeMonths(userId, redemptionId, rewardValue);
            break;
        case "feature_unlock":
            await fulfillFeatureUnlock(userId, redemptionId, rewardValue);
            break;
        default:
            throw new Error(`Unknown reward type: ${rewardType}`);
    }
}

async function fulfillStripeCredit(
    userId: number,
    redemptionId: number,
    value: Record<string, unknown>
): Promise<void> {
    const amountCents = value.amount_cents as number;
    const user = await prisma.authUser.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
    });

    if (user?.stripeCustomerId) {
        const stripe = getStripeInstance();
        await stripe.customers.createBalanceTransaction(user.stripeCustomerId, {
            amount: -amountCents, // Negative = credit
            currency: "usd",
            description: `ReimburseMe reward redemption #${redemptionId}`,
        });
    }

    await prisma.redemption.update({
        where: { id: redemptionId },
        data: {
            status: "fulfilled",
            fulfilledAt: new Date(),
            metadata: { type: "stripe_credit", amount_cents: amountCents },
        },
    });
}

async function fulfillFreeMonths(
    userId: number,
    redemptionId: number,
    value: Record<string, unknown>
): Promise<void> {
    const months = value.months as number;

    const user = await prisma.authUser.findUnique({
        where: { id: userId },
        select: { subscriptionEndsAt: true },
    });

    const baseDate = user?.subscriptionEndsAt ?? new Date();
    const newEnd = new Date(baseDate);
    newEnd.setMonth(newEnd.getMonth() + months);

    await prisma.authUser.update({
        where: { id: userId },
        data: { subscriptionEndsAt: newEnd },
    });

    await prisma.redemption.update({
        where: { id: redemptionId },
        data: {
            status: "fulfilled",
            fulfilledAt: new Date(),
            metadata: { type: "free_months", months, newEndDate: newEnd.toISOString() },
        },
    });
}

async function fulfillFeatureUnlock(
    _userId: number,
    redemptionId: number,
    value: Record<string, unknown>
): Promise<void> {
    // Feature unlock — record it; actual gating happens at feature check time
    await prisma.redemption.update({
        where: { id: redemptionId },
        data: {
            status: "fulfilled",
            fulfilledAt: new Date(),
            metadata: { type: "feature_unlock", feature: String(value.feature ?? "") },
        },
    });
}

// ── Seed Rewards Catalog ───────────────────────────────────

export const DEFAULT_REWARDS = [
    {
        title: "$10 Account Credit",
        description: "Apply a $10 credit to your next invoice",
        pointsCost: 500,
        rewardType: "stripe_credit",
        rewardValue: { amount_cents: 1000 },
        minTier: 1,
        sortOrder: 1,
    },
    {
        title: "1 Month Base Plan Free",
        description: "Get one month of the Base plan for free",
        pointsCost: 500,
        rewardType: "free_months",
        rewardValue: { months: 1, tier: "base" },
        minTier: 1,
        sortOrder: 2,
    },
    {
        title: "$25 Account Credit",
        description: "Apply a $25 credit to your next invoice",
        pointsCost: 1000,
        rewardType: "stripe_credit",
        rewardValue: { amount_cents: 2500 },
        minTier: 2,
        sortOrder: 3,
    },
    {
        title: "1 Month Premium Free",
        description: "Get one month of the Premium plan for free",
        pointsCost: 1500,
        rewardType: "free_months",
        rewardValue: { months: 1, tier: "premium" },
        minTier: 3,
        sortOrder: 4,
    },
    {
        title: "$75 Account Credit",
        description: "Apply a $75 credit to your next invoice",
        pointsCost: 3000,
        rewardType: "stripe_credit",
        rewardValue: { amount_cents: 7500 },
        minTier: 3,
        sortOrder: 5,
    },
    {
        title: "3 Months Base Plan Free",
        description: "Get three months of the Base plan for free",
        pointsCost: 3000,
        rewardType: "free_months",
        rewardValue: { months: 3, tier: "base" },
        minTier: 3,
        sortOrder: 6,
    },
    {
        title: "6 Months Premium Free",
        description: "Get six months of the Premium plan for free",
        pointsCost: 6000,
        rewardType: "free_months",
        rewardValue: { months: 6, tier: "premium" },
        minTier: 5,
        sortOrder: 7,
    },
    {
        title: "$200 Account Credit",
        description: "Apply a $200 credit to your account",
        pointsCost: 6000,
        rewardType: "stripe_credit",
        rewardValue: { amount_cents: 20000 },
        minTier: 5,
        sortOrder: 8,
    },
];

export async function seedRewardsCatalog(): Promise<void> {
    for (const reward of DEFAULT_REWARDS) {
        const existing = await prisma.rewardsCatalog.findFirst({
            where: { title: reward.title },
        });
        if (!existing) {
            await prisma.rewardsCatalog.create({ data: reward });
        }
    }
}
