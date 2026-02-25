import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { triggerReferralMilestone } from "@/lib/rewards/referrals";

/**
 * GET /api/cron/retention-check
 *
 * Vercel Cron Job — runs daily.
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/retention-check", "schedule": "0 3 * * *" }] }
 *
 * Awards retention milestones to referrers whose referred users
 * have been subscribed for at least 30/90 days with no prior reward.
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/retention-check
 *
 * Vercel Cron Job — runs daily.
 * Awards retention milestones to referrers whose referred users
 * have been subscribed for at least 30/90 days.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // Fetch referrals that are active or completed (completed means 90d was done, but we might still check 30d if missed)
        const eligibleReferrals = await prisma.referralTracking.findMany({
            where: {
                status: { in: ["active", "completed"] },
                createdAt: { lte: thirtyDaysAgo },
            },
            select: {
                id: true,
                referrerId: true,
                referredId: true,
                status: true,
                createdAt: true,
            }
        });

        let processed = 0;
        let awarded30 = 0;
        let awarded90 = 0;

        // Cache for user payment status in this run to avoid duplicate checks
        const paymentStatusCache = new Map<number, boolean>();

        const checkStillPaid = async (referredId: number) => {
            if (paymentStatusCache.has(referredId)) return paymentStatusCache.get(referredId);

            const referredUser = await prisma.authUser.findUnique({
                where: { id: referredId },
                select: { subscriptionTier: true, subscriptionStatus: true },
            });

            const isPaid = Boolean(
                referredUser &&
                referredUser.subscriptionTier !== "free" &&
                referredUser.subscriptionStatus === "active"
            );

            paymentStatusCache.set(referredId, isPaid);
            return isPaid;
        };

        for (const referral of eligibleReferrals) {
            processed++;
            const isActive = referral.status === "active";
            const isCompleted = referral.status === "completed";
            const createdDate = new Date(referral.createdAt);

            // 1. Process 30-Day Milestone (if not already completed)
            if (!isCompleted || isActive) { // Status "active" definitely needs checking; "completed" usually means both are done
                try {
                    const existing30 = await prisma.pointsLedger.findFirst({
                        where: {
                            userId: referral.referrerId,
                            source: "referral_retention_30d",
                            sourceId: String(referral.referredId),
                            type: "earn",
                        },
                    });

                    if (!existing30 && await checkStillPaid(referral.referredId)) {
                        await triggerReferralMilestone(referral.referredId, "RETENTION_30D");
                        awarded30++;
                        console.log(`RETENTION_30D awarded: referrer=${referral.referrerId} for referred=${referral.referredId}`);
                    }
                } catch (err) {
                    console.error(`Error processing 30d milestone for referral ${referral.id}:`, err);
                }
            }

            // 2. Process 90-Day Milestone (if eligible and not already completed)
            if (!isCompleted && createdDate <= ninetyDaysAgo) {
                try {
                    const existing90 = await prisma.pointsLedger.findFirst({
                        where: {
                            userId: referral.referrerId,
                            source: "referral_retention_90d",
                            sourceId: String(referral.referredId),
                            type: "earn",
                        },
                    });

                    if (!existing90 && await checkStillPaid(referral.referredId)) {
                        await triggerReferralMilestone(referral.referredId, "RETENTION_90D");

                        // Mark referral as completed after 90 days
                        await prisma.referralTracking.update({
                            where: { id: referral.id },
                            data: {
                                status: "completed",
                                completedAt: new Date(),
                            },
                        });

                        awarded90++;
                        console.log(`RETENTION_90D awarded: referrer=${referral.referrerId} for referred=${referral.referredId}`);
                    }
                } catch (err) {
                    console.error(`Error processing 90d milestone for referral ${referral.id}:`, err);
                }
            }
        }

        return NextResponse.json({
            success: true,
            processed,
            awarded30,
            awarded90,
            message: `Checked ${processed} referrals, awarded ${awarded30} (30d) and ${awarded90} (90d).`,
        });
    } catch (error) {
        console.error("Retention cron error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
