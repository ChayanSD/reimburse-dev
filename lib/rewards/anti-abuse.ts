import prisma from "@/lib/prisma";

// ── Constants ──────────────────────────────────────────────

const MONTHLY_EARNING_CAP = 5000;

// ── Monthly Cap ────────────────────────────────────────────

/**
 * Check if a user has hit the monthly earning cap.
 */
export async function checkMonthlyCap(userId: number): Promise<{
    allowed: boolean;
    earned: number;
    remaining: number;
}> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const result = await prisma.pointsLedger.aggregate({
        where: {
            userId,
            type: "earn",
            status: { in: ["available", "pending"] },
            createdAt: { gte: startOfMonth },
        },
        _sum: { points: true },
    });

    const earned = result._sum.points ?? 0;
    const remaining = Math.max(0, MONTHLY_EARNING_CAP - earned);

    return {
        allowed: earned < MONTHLY_EARNING_CAP,
        earned,
        remaining,
    };
}

/**
 * Cap points to monthly limit. Returns actual points to award.
 */
export async function capToMonthlyLimit(
    userId: number,
    requestedPoints: number
): Promise<number> {
    const { remaining } = await checkMonthlyCap(userId);
    return Math.min(requestedPoints, remaining);
}

// ── Self-Referral Prevention ───────────────────────────────

/**
 * Check if this looks like a self-referral.
 * Checks: same user ID, same email domain pattern.
 */
export async function isSelfReferral(
    referrerId: number,
    referredUserId: number
): Promise<boolean> {
    if (referrerId === referredUserId) return true;

    // Check if emails share the same uncommon domain
    const [referrer, referred] = await Promise.all([
        prisma.authUser.findUnique({
            where: { id: referrerId },
            select: { email: true },
        }),
        prisma.authUser.findUnique({
            where: { id: referredUserId },
            select: { email: true },
        }),
    ]);

    if (!referrer || !referred) return false;

    const referrerDomain = referrer.email.split("@")[1];
    const referredDomain = referred.email.split("@")[1];

    // Don't flag common email providers as self-referral
    const commonDomains = [
        "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
        "icloud.com", "protonmail.com", "mail.com", "aol.com",
    ];

    if (commonDomains.includes(referrerDomain)) return false;

    // Same corporate domain is suspicious
    return referrerDomain === referredDomain;
}

// ── Duplicate Earning Check ────────────────────────────────

/**
 * Check if points were already awarded for this exact source + sourceId.
 */
export async function isDuplicateEarning(
    userId: number,
    source: string,
    sourceId: string
): Promise<boolean> {
    const existing = await prisma.pointsLedger.findFirst({
        where: {
            userId,
            source,
            sourceId,
            type: "earn",
        },
    });

    return !!existing;
}
