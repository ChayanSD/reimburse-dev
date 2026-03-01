import prisma from "@/lib/prisma";
import crypto from "crypto";
import { earnPoints } from "./points";

// ── Referral Milestone Definitions ─────────────────────────

export const REFERRAL_MILESTONES = {
    PAID_SUBSCRIPTION_PRO: { source: "referral_paid_sub_pro", points: 600 },
    PAID_SUBSCRIPTION_PREMIUM: { source: "referral_paid_sub_premium", points: 1000 },
    RETENTION_30D: { source: "referral_retention_30d", points: 800 },
    RETENTION_90D: { source: "referral_retention_90d", points: 1500 },
} as const;

export type ReferralMilestoneKey = keyof typeof REFERRAL_MILESTONES;

export function getPaidSubscriptionMilestoneKey(tier: string): ReferralMilestoneKey | null {
    if (tier === "pro") return "PAID_SUBSCRIPTION_PRO";
    if (tier === "premium") return "PAID_SUBSCRIPTION_PREMIUM";
    return null;
}

// ── Code Generation ────────────────────────────────────────

/**
 * Generate a unique 8-char referral code and assign to user.
 */
export async function generateReferralCode(userId: number): Promise<string> {
    let code: string;
    let attempts = 0;

    do {
        code = crypto.randomBytes(4).toString("hex").toUpperCase();
        const existing = await prisma.authUser.findFirst({
            where: { referralCode: code },
        });
        if (!existing) break;
        attempts++;
    } while (attempts < 10);

    await prisma.authUser.update({
        where: { id: userId },
        data: { referralCode: code },
    });

    return code;
}

/**
 * Ensure a user has a referral code, generating one if missing.
 */
export async function ensureReferralCode(userId: number): Promise<string> {
    const user = await prisma.authUser.findUnique({
        where: { id: userId },
        select: { referralCode: true },
    });

    if (user?.referralCode) return user.referralCode;
    return generateReferralCode(userId);
}

/**
 * Get referral link for a code.
 */
export function getReferralLink(code: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://reimburseme.ai";
    return `${baseUrl}/r/${code}`;
}

// ── Attribution ────────────────────────────────────────────

/**
 * Attribute a signup to a referrer.
 * - First-touch only (checks if already attributed)
 * - Self-referral prevention
 * - Creates referral tracking (no points awarded at signup)
 */
export async function attributeReferral(
    referredUserId: number,
    referralCode: string
): Promise<{ success: boolean; error?: string }> {
    try {
        // Find referrer
        const referrer = await prisma.authUser.findFirst({
            where: { referralCode: referralCode },
            select: { id: true },
        });

        if (!referrer) {
            return { success: false, error: "Invalid referral code" };
        }

        // Prevent self-referral
        if (referrer.id === referredUserId) {
            return { success: false, error: "Self-referral not allowed" };
        }

        // Check first-touch (already attributed?)
        const existing = await prisma.referralTracking.findUnique({
            where: { referredId: referredUserId },
        });

        if (existing) {
            return { success: false, error: "User already attributed" };
        }

        // Create attribution
        await prisma.referralTracking.create({
            data: {
                referrerId: referrer.id,
                referredId: referredUserId,
                referralCode,
                status: "pending",
            },
        });

        // Update referred user's referredBy field
        await prisma.authUser.update({
            where: { id: referredUserId },
            data: { referredBy: referralCode },
        });

        return { success: true };
    } catch (error) {
        console.error("Referral attribution error:", error);
        return { success: false, error: "Attribution failed" };
    }
}

// ── Milestone Triggers ─────────────────────────────────────

/**
 * Trigger a referral milestone for the referred user.
 * Awards points to the REFERRER.
 */
export async function triggerReferralMilestone(
    referredUserId: number,
    milestoneKey: ReferralMilestoneKey
): Promise<void> {
    const referral = await prisma.referralTracking.findUnique({
        where: { referredId: referredUserId },
    });

    if (!referral) return; // No referral attribution

    const milestone = REFERRAL_MILESTONES[milestoneKey];

    // Check if already awarded
    const existing = await prisma.pointsLedger.findFirst({
        where: {
            userId: referral.referrerId,
            source: milestone.source,
            sourceId: String(referredUserId),
        },
    });

    if (existing) return; // Already awarded

    const isPending = "pendingDays" in milestone;

    await earnPoints(referral.referrerId, milestone.points, milestone.source, {
        status: isPending ? "pending" : "available",
        sourceId: String(referredUserId),
        note: `Referral milestone: ${milestoneKey} by user #${referredUserId}`,
        expiresAt: isPending
            ? new Date(Date.now() + (milestone as { pendingDays: number }).pendingDays * 24 * 60 * 60 * 1000)
            : undefined,
    });
}

/**
 * Called when referred user verifies email → mark referral active.
 */
export async function onReferredUserVerified(referredUserId: number): Promise<void> {
    const referral = await prisma.referralTracking.findUnique({
        where: { referredId: referredUserId },
    });

    if (!referral) return;

    // Update referral status
    await prisma.referralTracking.update({
        where: { id: referral.id },
        data: { status: "active" },
    });
}

// ── Stats ──────────────────────────────────────────────────

export interface ReferralStats {
    code: string;
    link: string;
    totalReferrals: number;
    activeReferrals: number;
    totalPointsEarned: number;
}

/**
 * Get referral stats for a user.
 */
export async function getReferralStats(userId: number): Promise<ReferralStats> {
    const code = await ensureReferralCode(userId);
    const link = getReferralLink(code);

    const [totalReferrals, activeReferrals, pointsEarned] = await Promise.all([
        prisma.referralTracking.count({ where: { referrerId: userId } }),
        prisma.referralTracking.count({
            where: { referrerId: userId, status: { in: ["active", "completed"] } },
        }),
        prisma.pointsLedger.aggregate({
            where: {
                userId,
                source: { startsWith: "referral_" },
                status: "available",
                type: "earn",
            },
            _sum: { points: true },
        }),
    ]);

    return {
        code,
        link,
        totalReferrals,
        activeReferrals,
        totalPointsEarned: pointsEarned._sum.points ?? 0,
    };
}
