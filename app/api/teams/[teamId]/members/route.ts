import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { can, getTeamMember } from "@/lib/permissions";
import crypto from "crypto";
import { MISSION_KEYS, checkAndCompleteMission } from "@/lib/rewards/missions";

const inviteMemberSchema = z.object({
  email: z.email(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

// GET /api/teams/[teamId]/members - List members
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await context.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tid = parseInt(teamId);
  if (isNaN(tid)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const currentUser = await getTeamMember(session.id, tid);
  if (!currentUser) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const members = await prisma.teamMember.findMany({
    where: { teamId: tid },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          // avatarUrl? if exists
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  const invites = await prisma.teamInvite.findMany({
    where: {
      teamId: tid,
      status: "pending",
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json({ members, invites });
}

// POST /api/teams/[teamId]/members - Invite member
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await context.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tid = parseInt(teamId);
  if (isNaN(tid)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const currentUser = await getTeamMember(session.id, tid);
  if (!currentUser || !can(currentUser.role, "invite_member")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch team details for the email
  const team = await prisma.team.findUnique({
    where: { id: tid },
    select: { name: true }
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Get inviter details
  const inviter = await prisma.authUser.findUnique({
    where: { id: session.id },
    select: { firstName: true, lastName: true, email: true }
  });

  const inviterName = [inviter?.firstName, inviter?.lastName].filter(Boolean).join(" ") || inviter?.email || "Someone";

  try {
    const body = await req.json();
    const { email, role } = inviteMemberSchema.parse(body);

    // Check if user is already a member
    const userToInvite = await prisma.authUser.findUnique({
      where: { email },
    });

    if (userToInvite) {
      const existingMember = await prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId: tid,
            userId: userToInvite.id,
          },
        },
      });

      if (existingMember) {
        return NextResponse.json({ error: "User is already a member" }, { status: 409 });
      }
    }

    // Check for pending invites
    const existingInvite = await prisma.teamInvite.findFirst({
      where: {
        teamId: tid,
        email: email,
        status: "pending",
        expiresAt: { gt: new Date() }
      }
    });

    if (existingInvite) {
      return NextResponse.json({ error: "Invitation already pending" }, { status: 409 });
    }

    // Create Invite
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    await prisma.teamInvite.create({
      data: {
        teamId: tid,
        email,
        role,
        token,
        expiresAt,
        status: "pending"
      }
    });

    // Send Email
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/join-team?token=${token}`;

    // Dynamically import to avoid top-level await issues if any
    const { sendTeamInviteEmail } = await import("@/lib/emailService");

    await sendTeamInviteEmail({
      to: email,
      teamName: team.name,
      inviterName: inviterName,
      inviteLink
    });

    // REWARDS: MISSION COMPLETE (invite_team)
    try {
      await checkAndCompleteMission(session.id, MISSION_KEYS.INVITE_TEAM);
    } catch (rewardsError) {
      console.error("Rewards hook error (invite_team):", rewardsError);
    }

    return NextResponse.json({ message: "Invitation sent successfully" }, { status: 200 });

  } catch (error) {
    console.error(error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
