import prisma from "@/lib/prisma";

// ── Types ──────────────────────────────────────────────────

export type LedgerType = "earn" | "spend" | "reversal" | "adjustment";
export type LedgerStatus = "pending" | "available" | "voided";

export interface EarnOptions {
    status?: LedgerStatus;
    sourceId?: string;
    note?: string;
    expiresAt?: Date;
}

export interface PointsBalance {
    available: number;
    pending: number;
    lifetime: number;
}

export interface LedgerEntry {
    id: number;
    type: LedgerType;
    status: LedgerStatus;
    points: number;
    source: string;
    sourceId: string | null;
    note: string | null;
    createdAt: Date;
}

// ── Core Ledger Operations ─────────────────────────────────

/**
 * Award points to a user. Defaults to "available" status.
 */
export async function earnPoints(
    userId: number,
    points: number,
    source: string,
    opts: EarnOptions = {}
): Promise<LedgerEntry> {
    const { status = "available", sourceId, note, expiresAt } = opts;

    const entry = await prisma.pointsLedger.create({
        data: {
            userId,
            type: "earn",
            status,
            points,
            source,
            sourceId: sourceId ?? null,
            note: note ?? null,
            expiresAt: expiresAt ?? null,
        },
    });

    return entry as unknown as LedgerEntry;
}

/**
 * Spend points from a user's available balance.
 * Throws if insufficient points.
 */
export async function spendPoints(
    userId: number,
    points: number,
    source: string,
    sourceId?: string
): Promise<LedgerEntry> {
    const balance = await getAvailableBalance(userId);
    if (balance < points) {
        throw new Error(`Insufficient points. Available: ${balance}, Requested: ${points}`);
    }

    const entry = await prisma.pointsLedger.create({
        data: {
            userId,
            type: "spend",
            status: "available",
            points,
            source,
            sourceId: sourceId ?? null,
        },
    });

    return entry as unknown as LedgerEntry;
}

/**
 * Reverse a previous ledger entry (e.g., refund).
 */
export async function reversePoints(
    userId: number,
    originalLedgerId: number,
    note?: string
): Promise<LedgerEntry> {
    const original = await prisma.pointsLedger.findUnique({
        where: { id: originalLedgerId },
    });

    if (!original || original.userId !== userId) {
        throw new Error("Original ledger entry not found");
    }

    const entry = await prisma.pointsLedger.create({
        data: {
            userId,
            type: "reversal",
            status: "available",
            points: original.points,
            source: original.source,
            sourceId: String(originalLedgerId),
            note: note ?? `Reversal of entry #${originalLedgerId}`,
        },
    });

    return entry as unknown as LedgerEntry;
}

/**
 * Admin adjustment — can be positive or negative.
 */
export async function adjustPoints(
    userId: number,
    points: number,
    note: string,
    adminId?: number
): Promise<LedgerEntry> {
    const entry = await prisma.pointsLedger.create({
        data: {
            userId,
            type: "adjustment",
            status: "available",
            points,
            source: "admin",
            sourceId: adminId ? String(adminId) : null,
            note,
        },
    });

    return entry as unknown as LedgerEntry;
}

// ── Pending → Available Conversion ─────────────────────────

/**
 * Convert pending points to available for a given source/sourceId.
 */
export async function convertPendingToAvailable(
    userId: number,
    source: string,
    sourceId?: string
): Promise<number> {
    const where: Record<string, unknown> = {
        userId,
        source,
        type: "earn",
        status: "pending",
    };
    if (sourceId) where.sourceId = sourceId;

    const result = await prisma.pointsLedger.updateMany({
        where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        data: { status: "available" },
    });

    return result.count;
}

/**
 * Void pending points (e.g., if referral was fraudulent).
 */
export async function voidPendingPoints(
    userId: number,
    source: string,
    sourceId?: string
): Promise<number> {
    const where: Record<string, unknown> = {
        userId,
        source,
        type: "earn",
        status: "pending",
    };
    if (sourceId) where.sourceId = sourceId;

    const result = await prisma.pointsLedger.updateMany({
        where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        data: { status: "voided" },
    });

    return result.count;
}

// ── Balance Queries ────────────────────────────────────────

/**
 * Get the user's spendable balance.
 * Balance = sum(available earn + adjustment) - sum(available spend + reversal)
 */
export async function getAvailableBalance(userId: number): Promise<number> {
    const earned = await prisma.pointsLedger.aggregate({
        where: { userId, status: "available", type: { in: ["earn", "adjustment"] } },
        _sum: { points: true },
    });

    const spent = await prisma.pointsLedger.aggregate({
        where: { userId, status: "available", type: { in: ["spend", "reversal"] } },
        _sum: { points: true },
    });

    return (earned._sum.points ?? 0) - (spent._sum.points ?? 0);
}

/**
 * Get pending points (not yet available).
 */
export async function getPendingPoints(userId: number): Promise<number> {
    const result = await prisma.pointsLedger.aggregate({
        where: { userId, status: "pending", type: "earn" },
        _sum: { points: true },
    });
    return result._sum.points ?? 0;
}

/**
 * Get total lifetime earned (all available earn entries — used for tier calc).
 */
export async function getLifetimeEarned(userId: number): Promise<number> {
    const result = await prisma.pointsLedger.aggregate({
        where: { userId, status: "available", type: { in: ["earn", "adjustment"] } },
        _sum: { points: true },
    });
    return result._sum.points ?? 0;
}

/**
 * Full balance object.
 */
export async function getPointsBalance(userId: number): Promise<PointsBalance> {
    const [available, pending, lifetime] = await Promise.all([
        getAvailableBalance(userId),
        getPendingPoints(userId),
        getLifetimeEarned(userId),
    ]);

    return { available, pending, lifetime };
}

/**
 * Paginated points history.
 */
export async function getPointsHistory(
    userId: number,
    page = 1,
    limit = 20
): Promise<{ entries: LedgerEntry[]; total: number }> {
    const [entries, total] = await Promise.all([
        prisma.pointsLedger.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.pointsLedger.count({ where: { userId } }),
    ]);

    return {
        entries: entries as unknown as LedgerEntry[],
        total,
    };
}
