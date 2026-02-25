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

// ── Helpers ───────────────────────────────────────────────

function getRewardSubscriptionRequirements(value: Record<string, unknown>): {
    requiresTier?: string;
    requiresPaid?: boolean;
} {
    const requiresTier = typeof value.requiresTier === "string" ? value.requiresTier : undefined;
    const requiresPaid = typeof value.requiresPaid === "boolean" ? value.requiresPaid : false;
    return { requiresTier, requiresPaid };
}

function isSubscriptionEligible(
    user: { subscriptionTier: string; subscriptionStatus: string } | null,
    value: Record<string, unknown>
): boolean {
    const { requiresTier, requiresPaid } = getRewardSubscriptionRequirements(value);
    if (!requiresTier && !requiresPaid) return true;

    if (!user) return false;
    const isPaid = user.subscriptionTier !== "free" && user.subscriptionStatus === "active";
    if (requiresPaid && !isPaid) return false;
    if (requiresTier && user.subscriptionTier !== requiresTier) return false;
    return true;
}

// ── Catalog ────────────────────────────────────────────────

/**
 * Get available rewards filtered by user's tier.
 */
export async function getRewardsCatalog(userId: number): Promise<RewardItem[]> {
    const [rewards, tier, balance, user] = await Promise.all([
        prisma.rewardsCatalog.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
        }),
        getUserTier(userId),
        (await import("./points")).getAvailableBalance(userId),
        prisma.authUser.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionStatus: true },
        }),
    ]);

    return rewards.map((r) => {
        const rewardValue = (r.rewardValue ?? {}) as Record<string, unknown>;
        return {
            id: r.id,
            title: r.title,
            description: r.description,
            pointsCost: r.pointsCost,
            rewardType: r.rewardType,
            rewardValue,
            minTier: r.minTier,
            sortOrder: r.sortOrder,
            canRedeem:
                tier.level >= r.minTier &&
                balance >= r.pointsCost &&
                isSubscriptionEligible(user, rewardValue),
        };
    });
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

        const rewardValue = (reward.rewardValue ?? {}) as Record<string, unknown>;

        const user = await prisma.authUser.findUnique({
            where: { id: userId },
            select: { subscriptionTier: true, subscriptionStatus: true },
        });

        if (!isSubscriptionEligible(user, rewardValue)) {
            return { success: false, error: "Not eligible for this reward with current plan" };
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
            await fulfillReward(userId, redemption.id, reward.rewardType, rewardValue);
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
        case "percent_off_next_invoice":
            await fulfillPercentOffNextInvoice(userId, redemptionId, rewardValue);
            break;
        case "free_months":
            await fulfillFreeMonths(userId, redemptionId, rewardValue);
            break;
        case "lifetime_discount":
            await fulfillLifetimeDiscount(userId, redemptionId, rewardValue);
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

async function fulfillPercentOffNextInvoice(
    userId: number,
    redemptionId: number,
    value: Record<string, unknown>
): Promise<void> {
    const percent = Number(value.percent ?? 0);
    if (!percent || percent <= 0) {
        throw new Error("Invalid percent value for discount reward");
    }

    const user = await prisma.authUser.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, subscriptionTier: true, subscriptionStatus: true },
    });

    if (!user || user.subscriptionTier === "free" || user.subscriptionStatus !== "active") {
        throw new Error("User is not on an active paid plan");
    }

    const requiresTier = typeof value.requiresTier === "string" ? value.requiresTier : null;
    if (requiresTier && user.subscriptionTier !== requiresTier) {
        throw new Error("Reward requires a different subscription tier");
    }

    const tier = await prisma.subscriptionTier.findUnique({
        where: { tierName: user.subscriptionTier },
        select: { monthlyPriceCents: true },
    });

    if (!tier?.monthlyPriceCents) {
        throw new Error("Unable to determine subscription price for discount reward");
    }

    const amountCents = Math.max(1, Math.round(tier.monthlyPriceCents * (percent / 100)));
    if (!user.stripeCustomerId) {
        throw new Error("Stripe customer not found");
    }

    const stripe = getStripeInstance();
    await stripe.customers.createBalanceTransaction(user.stripeCustomerId, {
        amount: -amountCents,
        currency: "usd",
        description: `ReimburseMe ${percent}% off next month (reward #${redemptionId})`,
    });

    await prisma.redemption.update({
        where: { id: redemptionId },
        data: {
            status: "fulfilled",
            fulfilledAt: new Date(),
            metadata: {
                type: "percent_off_next_invoice",
                percent,
                amount_cents: amountCents,
                tier: user.subscriptionTier,
            },
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

async function fulfillLifetimeDiscount(
    userId: number,
    redemptionId: number,
    value: Record<string, unknown>
): Promise<void> {
    const percent = Number(value.percent ?? 0);
    if (!percent || percent <= 0) {
        throw new Error("Invalid percent value for lifetime discount reward");
    }

    const user = await prisma.authUser.findUnique({
        where: { id: userId },
        select: { lifetimeDiscount: true },
    });

    const current = Number(user?.lifetimeDiscount ?? 0);
    const next = Math.max(current, percent);

    await prisma.authUser.update({
        where: { id: userId },
        data: { lifetimeDiscount: next },
    });

    await prisma.redemption.update({
        where: { id: redemptionId },
        data: {
            status: "fulfilled",
            fulfilledAt: new Date(),
            metadata: { type: "lifetime_discount", percent: next },
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
        title: "20% Off Next Month",
        description: "One-time credit equal to 20% of your next monthly invoice",
        pointsCost: 1000,
        rewardType: "percent_off_next_invoice",
        rewardValue: { percent: 20, requiresPaid: true },
        minTier: 2,
        sortOrder: 1,
    },
    {
        title: "50% Off Next Month",
        description: "One-time credit equal to 50% of your next monthly invoice",
        pointsCost: 2500,
        rewardType: "percent_off_next_invoice",
        rewardValue: { percent: 50, requiresPaid: true },
        minTier: 3,
        sortOrder: 2,
    },
    {
        title: "1 Free Pro Month",
        description: "Get one free month on the Pro plan",
        pointsCost: 4000,
        rewardType: "free_months",
        rewardValue: { months: 1, requiresTier: "pro", requiresPaid: true },
        minTier: 4,
        sortOrder: 3,
    },
    {
        title: "50% Off Premium Next Month",
        description: "One-time credit equal to 50% of your Premium monthly invoice",
        pointsCost: 4000,
        rewardType: "percent_off_next_invoice",
        rewardValue: { percent: 50, requiresTier: "premium", requiresPaid: true },
        minTier: 4,
        sortOrder: 4,
    },
    {
        title: "1 Free Premium Month",
        description: "Get one free month on the Premium plan",
        pointsCost: 7000,
        rewardType: "free_months",
        rewardValue: { months: 1, requiresTier: "premium", requiresPaid: true },
        minTier: 5,
        sortOrder: 5,
    },
    {
        title: "Ambassador Tier: 10% Recurring Commission",
        description: "Unlock ambassador commission tracking (manual payout)",
        pointsCost: 12000,
        rewardType: "feature_unlock",
        rewardValue: { feature: "ambassador_commission_10" },
        minTier: 6,
        sortOrder: 6,
    },
    {
        title: "Ambassador Tier: 15% Lifetime Discount",
        description: "Apply a permanent 15% discount cap to your subscription",
        pointsCost: 12000,
        rewardType: "lifetime_discount",
        rewardValue: { percent: 15, requiresPaid: true },
        minTier: 6,
        sortOrder: 7,
    },
];

export async function seedRewardsCatalog(): Promise<void> {
    for (const reward of DEFAULT_REWARDS) {
        const existing = await prisma.rewardsCatalog.findFirst({
            where: { title: reward.title },
        });
        if (!existing) {
            await prisma.rewardsCatalog.create({ data: reward });
        } else {
            await prisma.rewardsCatalog.update({
                where: { id: existing.id },
                data: reward,
            });
        }
    }
}
