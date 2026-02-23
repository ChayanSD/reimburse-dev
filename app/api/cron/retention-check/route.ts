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
 * Awards RETENTION_30D milestone (+500 pts) to referrers whose referred users
 * have been subscribed for at least 30 days with no prior RETENTION_30D reward.
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

        // Find active referrals where it's been 30+ days since creation
        // and RETENTION_30D milestone hasn't been awarded yet
        const eligibleReferrals = await prisma.referralTracking.findMany({
            where: {
                status: "active",
                createdAt: { lte: thirtyDaysAgo },
            },
            select: {
                id: true,
                referrerId: true,
                referredId: true,
            },
        });

        let processed = 0;
        let awarded = 0;

        for (const referral of eligibleReferrals) {
            processed++;
            try {
                // Check if RETENTION_30D was already awarded for this referred user
                const existing = await prisma.pointsLedger.findFirst({
                    where: {
                        userId: referral.referrerId,
                        source: "referral_retention_30d",
                        sourceId: String(referral.referredId),
                        type: "earn",
                    },
                });

                if (existing) continue; // Already awarded

                // Confirm the referred user is still on a paid subscription
                const referredUser = await prisma.authUser.findUnique({
                    where: { id: referral.referredId },
                    select: { subscriptionTier: true, subscriptionStatus: true },
                });

                if (
                    !referredUser ||
                    referredUser.subscriptionTier === "free" ||
                    referredUser.subscriptionStatus !== "active"
                ) {
                    continue; // Not on a paid plan
                }

                // Trigger the retention milestone
                await triggerReferralMilestone(referral.referredId, "RETENTION_30D");

                // Update referral status to completed
                await prisma.referralTracking.update({
                    where: { id: referral.id },
                    data: {
                        status: "completed",
                        completedAt: new Date(),
                    },
                });

                awarded++;
                console.log(`RETENTION_30D awarded: referrer=${referral.referrerId} for referred=${referral.referredId}`);
            } catch (err) {
                console.error(`Error processing referral ${referral.id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            processed,
            awarded,
            message: `Checked ${processed} referrals, awarded RETENTION_30D to ${awarded} referrers.`,
        });
    } catch (error) {
        console.error("Retention cron error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
