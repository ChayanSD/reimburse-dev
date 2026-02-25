import prisma from "@/lib/prisma";
import { earnPoints } from "./points";

// ── Mission Keys ───────────────────────────────────────────

export const MISSION_KEYS = {
    FIRST_UPLOAD: "first_upload",
    CONNECT_EMAIL: "connect_email",
    FIRST_EXPORT: "first_export",
    INVITE_TEAM: "invite_team",
} as const;

export type MissionKey = (typeof MISSION_KEYS)[keyof typeof MISSION_KEYS];

// ── Default Mission Seed Data ──────────────────────────────

export const DEFAULT_MISSIONS = [
    {
        key: MISSION_KEYS.FIRST_UPLOAD,
        title: "Upload Your First Receipt",
        description: "Upload and save your first receipt to get started",
        points: 50,
        sortOrder: 1,
    },
    {
        key: MISSION_KEYS.CONNECT_EMAIL,
        title: "Connect Email Auto-Import",
        description: "Connect your Gmail to automatically import receipts",
        points: 100,
        sortOrder: 2,
    },
    {
        key: MISSION_KEYS.FIRST_EXPORT,
        title: "Generate Your First Report",
        description: "Create your first expense reimbursement report",
        points: 100,
        sortOrder: 3,
    },
    {
        key: MISSION_KEYS.INVITE_TEAM,
        title: "Invite a Team Member",
        description: "Create a team and invite a colleague to collaborate",
        points: 150,
        sortOrder: 4,
    },
];

// ── Mission Operations ─────────────────────────────────────

export interface UserMission {
    id: string;
    key: string;
    title: string;
    description: string | null;
    points: number;
    sortOrder: number;
    completed: boolean;
    completedAt: Date | null;
}

/**
 * Idempotent: Check if a mission is already completed; if not, complete it and award points.
 * Returns true if the mission was newly completed.
 */
export async function checkAndCompleteMission(
    userId: number,
    missionKey: string
): Promise<boolean> {
    try {
        // Find mission
        const mission = await prisma.mission.findUnique({
            where: { key: missionKey },
        });

        if (!mission || !mission.isActive) return false;

        // Check if already completed (idempotent)
        const existing = await prisma.missionCompletion.findUnique({
            where: {
                userId_missionId: { userId, missionId: mission.id },
            },
        });

        if (existing) return false;

        // Complete mission + award points in a transaction
        await prisma.$transaction(async (tx) => {
            await tx.missionCompletion.create({
                data: {
                    userId,
                    missionId: mission.id,
                },
            });
        });

        // Award points (outside tx so ledger logic works)
        await earnPoints(userId, mission.points, `mission_${missionKey}`, {
            sourceId: mission.id,
            note: `Mission completed: ${mission.title}`,
        });

        return true;
    } catch (error) {
        // If unique constraint violation, it was already completed
        if ((error as { code?: string }).code === "P2002") return false;
        console.error(`Mission completion error (${missionKey}):`, error);
        return false;
    }
}

/**
 * Get all missions with completion status for a user.
 */
export async function getUserMissions(userId: number): Promise<UserMission[]> {
    const missions = await prisma.mission.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
            completions: {
                where: { userId },
                select: { completedAt: true },
            },
        },
    });

    return missions.map((m) => ({
        id: m.id,
        key: m.key,
        title: m.title,
        description: m.description,
        points: m.points,
        sortOrder: m.sortOrder,
        completed: m.completions.length > 0,
        completedAt: m.completions[0]?.completedAt ?? null,
    }));
}

/**
 * Seed default missions if they don't exist.
 */
export async function seedMissions(): Promise<void> {
    for (const mission of DEFAULT_MISSIONS) {
        await prisma.mission.upsert({
            where: { key: mission.key },
            update: {},
            create: mission,
        });
    }
}
