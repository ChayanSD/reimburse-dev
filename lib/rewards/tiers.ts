import { getLifetimeEarned } from "./points";

// ── Tier Definitions ───────────────────────────────────────

export const TIER_THRESHOLDS = [
    { level: 1, name: "Bronze", minPoints: 0 },
    { level: 2, name: "Silver", minPoints: 500 },
    { level: 3, name: "Gold", minPoints: 1500 },
    { level: 4, name: "Platinum", minPoints: 3000 },
    { level: 5, name: "Diamond", minPoints: 6000 },
] as const;

export interface TierInfo {
    level: number;
    name: string;
    minPoints: number;
    lifetimePoints: number;
    nextTierAt: number | null;
    nextTierName: string | null;
    progress: number; // 0-100% progress to next tier
}

// ── Tier Calculation ───────────────────────────────────────

/**
 * Calculate tier from lifetime points.
 */
export function calculateTier(lifetimePoints: number): (typeof TIER_THRESHOLDS)[number] {
    let current: (typeof TIER_THRESHOLDS)[number] = TIER_THRESHOLDS[0];
    for (const tier of TIER_THRESHOLDS) {
        if (lifetimePoints >= tier.minPoints) {
            current = tier;
        } else {
            break;
        }
    }
    return current;
}

/**
 * Get full tier info for a user.
 */
export async function getUserTier(userId: number): Promise<TierInfo> {
    const lifetimePoints = await getLifetimeEarned(userId);
    const current = calculateTier(lifetimePoints);

    const nextTierIndex = TIER_THRESHOLDS.findIndex((t) => t.level === current.level) + 1;
    const nextTier = nextTierIndex < TIER_THRESHOLDS.length ? TIER_THRESHOLDS[nextTierIndex] : null;

    let progress = 100;
    if (nextTier) {
        const range = nextTier.minPoints - current.minPoints;
        const earned = lifetimePoints - current.minPoints;
        progress = Math.min(100, Math.round((earned / range) * 100));
    }

    return {
        level: current.level,
        name: current.name,
        minPoints: current.minPoints,
        lifetimePoints,
        nextTierAt: nextTier?.minPoints ?? null,
        nextTierName: nextTier?.name ?? null,
        progress,
    };
}
