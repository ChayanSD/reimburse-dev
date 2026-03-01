import prisma from "./prisma";
import type { TeamRole } from "../app/generated/prisma/client";

export type Action =
  | "manage_team"
  | "invite_member"
  | "remove_member"
  | "update_member_role"
  | "view_all_receipts"
  | "create_receipt"
  | "delete_receipt"
  | "approve_receipt"
  | "view_analytics"
  | "view_audit_logs";

const ROLE_PERMISSIONS: Record<TeamRole, Action[]> = {
  OWNER: [
    "manage_team",
    "invite_member",
    "remove_member",
    "update_member_role",
    "view_all_receipts",
    "create_receipt",
    "delete_receipt",
    "approve_receipt",
    "view_analytics",
    "view_audit_logs",
  ],
  ADMIN: [
    "invite_member",
    "remove_member",
    "view_all_receipts",
    "create_receipt",
    "delete_receipt",
    "approve_receipt",
    "view_analytics",
    "view_audit_logs",
  ],
  MEMBER: [
    "create_receipt",
    // Can only view own receipts, handled by query logic, not generic permission
  ],
  VIEWER: [
    "view_all_receipts",
    "view_analytics",
    // Audit logs: "Optional access" - let's exclude by default or make it specific
  ],
};

export function can(role: TeamRole, action: Action): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false;
}

export async function getTeamMember(userId: number, teamId: number) {
  return prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      team: {
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

