/**
 * Seed script for Rewards system.
 * Run with: npx tsx prisma/seed-rewards.ts
 */
import prisma from "../lib/prisma";
import { seedMissions } from "../lib/rewards/missions";
import { seedRewardsCatalog } from "../lib/rewards/redemptions";

async function main() {
    console.log("🎯 Seeding missions...");
    await seedMissions();
    console.log("✅ Missions seeded");

    console.log("🎁 Seeding rewards catalog...");
    await seedRewardsCatalog();
    console.log("✅ Rewards catalog seeded");

    // Generate referral codes for existing users who don't have one
    console.log("🔗 Generating referral codes for existing users...");
    const usersWithoutCodes = await prisma.authUser.findMany({
        where: { referralCode: null },
        select: { id: true },
    });

    const crypto = await import("crypto");
    for (const user of usersWithoutCodes) {
        const code = crypto.randomBytes(4).toString("hex").toUpperCase();
        try {
            await prisma.authUser.update({
                where: { id: user.id },
                data: { referralCode: code },
            });
            console.log(`  User ${user.id} → ${code}`);
        } catch {
            // Unique constraint — retry with different code
            const retryCode = crypto.randomBytes(4).toString("hex").toUpperCase();
            await prisma.authUser.update({
                where: { id: user.id },
                data: { referralCode: retryCode },
            });
            console.log(`  User ${user.id} → ${retryCode} (retry)`);
        }
    }
    console.log(`✅ Generated codes for ${usersWithoutCodes.length} users`);

    console.log("\n🎉 Rewards system seeding complete!");
}

main()
    .catch((e) => {
        console.error("Seed error:", e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
