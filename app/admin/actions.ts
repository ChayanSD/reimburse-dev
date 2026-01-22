"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Types for our chart data
export interface ChartData {
  name: string;
  value: number;
}

export interface UserGrowthData {
  date: string;
  count: number;
}

export interface DashboardStats {
  totalUsers: number;
  activeSubscriptions: number;
  totalRevenue: number;
  totalReceipts: number;
  usersChange: number; // percentage change from last month
  revenueChange: number;
  receiptsChange: number;
  ocrSuccessRate: number;
  ocrChange: number;
}

export interface Anomaly {
  type: string;
  description: string;
  detected_at: string;
  severity: "low" | "medium" | "high";
  data?: any;
}

export async function checkAdminAccess() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }
}

export async function getDashboardStats(days: number = 30): Promise<DashboardStats> {
  await checkAdminAccess();

  const now = new Date();
  const date = new Date();
  date.setDate(date.getDate() - days);

  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - days); // Comparison period

  // 1. Total Users
  const totalUsers = await prisma.authUser.count(); // Total is always total

  // Users Change (Growth in selected period vs previous period)
  const usersCurrentPeriod = await prisma.authUser.count({
    where: { createdAt: { gte: date } },
  });
  
  const usersPrevPeriod = await prisma.authUser.count({
    where: { 
      createdAt: { 
        gte: prevDate,
        lt: date 
      } 
    },
  });

  const usersChange = usersPrevPeriod > 0 
    ? Math.round(((usersCurrentPeriod - usersPrevPeriod) / usersPrevPeriod) * 100) 
    : usersCurrentPeriod > 0 ? 100 : 0;

  // 2. Active Subscriptions
  const activeSubscriptions = await prisma.authUser.count({
    where: { 
      OR: [
        { subscriptionStatus: "active" },
        { subscriptionStatus: "trialing" }
      ]
    },
  });

  // 3. Revenue
  const proUsers = await prisma.authUser.count({ where: { subscriptionTier: "pro" } });
  const premiumUsers = await prisma.authUser.count({ where: { subscriptionTier: "premium" } });
  const ESTIMATED_REV = (proUsers * 10) + (premiumUsers * 20);
  
  // 4. Receipts Stats
  const totalReceipts = await prisma.receipt.count();
  
  const receiptsCurrentPeriod = await prisma.receipt.count({
    where: { createdAt: { gte: date } },
  });
  
  const receiptsPrevPeriod = await prisma.receipt.count({
    where: { 
      createdAt: { 
        gte: prevDate,
        lt: date 
      } 
    },
  });

  const receiptsChange = receiptsPrevPeriod > 0
    ? Math.round(((receiptsCurrentPeriod - receiptsPrevPeriod) / receiptsPrevPeriod) * 100)
    : receiptsCurrentPeriod > 0 ? 100 : 0;

  // 5. OCR Stats
  const ocrAttempts = await prisma.auditLog.count({
    where: {
      eventType: 'OCR_PROCESSED',
      createdAt: { gte: date }
    },
  });

  const ocrFailures = await prisma.auditLog.count({
    where: {
      eventType: 'OCR_FAILED',
      createdAt: { gte: date }
    },
  });

  const totalOcr = ocrAttempts + ocrFailures;
  const ocrSuccessRate = totalOcr > 0 ? (ocrAttempts / totalOcr) * 100 : 100;

  return {
    totalUsers,
    activeSubscriptions,
    totalRevenue: ESTIMATED_REV,
    totalReceipts,
    usersChange,
    revenueChange: 0,
    receiptsChange,
    ocrSuccessRate,
    ocrChange: 0 // Need historical
  };
}

export async function getUserGrowthData(days: number = 30): Promise<UserGrowthData[]> {
  await checkAdminAccess();

  // Get last X days
  const date = new Date();
  date.setDate(date.getDate() - days);
  
  const users = await prisma.authUser.groupBy({
    by: ['createdAt'],
    where: {
      createdAt: {
        gte: date
      }
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  // Aggregate by day in JS (Prisma groupBy returns distinct timestamps)
  const groupedByDay: Record<string, number> = {};
  
  users.forEach(u => {
    const day = u.createdAt.toISOString().split('T')[0];
    groupedByDay[day] = (groupedByDay[day] || 0) + 1;
  });

  // Fill in missing days
  const result: UserGrowthData[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - ((days - 1) - i)); // Adjusted loop to go from past to present correctly
    const dateStr = d.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: groupedByDay[dateStr] || 0
    });
  }

  return result;
}

export async function getReceiptActivityData(): Promise<ChartData[]> {
    await checkAdminAccess();
    
    // Group receipts by status or category for a pie chart?
    // Or just activity over last 7 days? Let's do activity over 7 days.
    
    const date = new Date();
    date.setDate(date.getDate() - 7);

    const receipts = await prisma.receipt.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: date } },
    });

    const groupedByDay: Record<string, number> = {};
    receipts.forEach(r => {
        const day = r.createdAt.toISOString().split('T')[0];
        groupedByDay[day] = (groupedByDay[day] || 0) + 1;
    });

    const result: ChartData[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().split('T')[0];
        result.push({
            name: dateStr, // Shorten this in UI?
            value: groupedByDay[dateStr] || 0
        });
    }
    return result;
}

export async function getAnomalies(): Promise<Anomaly[]> {
  await checkAdminAccess();
  const anomalies: Anomaly[] = [];

  // Check for large amounts (> $1000)
  const largeAmounts = await prisma.receipt.findMany({
    where: {
      amount: { gt: 1000 },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    },
    take: 5,
    orderBy: { amount: 'desc' }
  });

  if (largeAmounts.length > 0) {
    anomalies.push({
      type: "High Value Transactions",
      description: `${largeAmounts.length} receipts over $1,000 detected`,
      detected_at: new Date().toISOString(),
      severity: "medium",
      data: largeAmounts
    });
  }

  // Check for High OCR Failure Rate (last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentOcrAttempts = await prisma.auditLog.count({
    where: { eventType: 'OCR_PROCESSED', createdAt: { gte: yesterday } }
  });
  const recentOcrFailures = await prisma.auditLog.count({
    where: { eventType: 'OCR_FAILED', createdAt: { gte: yesterday } }
  });
  
  const totalRecent = recentOcrAttempts + recentOcrFailures;
  const failureRate = totalRecent > 0 ? recentOcrFailures / totalRecent : 0;
  
  if (failureRate > 0.3 && totalRecent > 5) {
      anomalies.push({
          type: "High OCR Failure Rate",
          description: `OCR failure rate is ${(failureRate * 100).toFixed(1)}% in the last 24h`,
          detected_at: new Date().toISOString(),
          severity: "high"
      });
  }

  return anomalies;
}

export async function getRecentSignups() {
    await checkAdminAccess();
    return await prisma.authUser.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            createdAt: true,
            subscriptionTier: true,
            role: true
        }
    });
}

export async function getActivityLogs() {
    await checkAdminAccess();
    return await prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
            user: {
                select: {
                    email: true
                }
            }
        }
    });
}


export async function getAllUsers(page: number = 1, limit: number = 10, search: string = "") {
  await checkAdminAccess();
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [users, total] = await Promise.all([
    prisma.authUser.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        createdAt: true,
      }
    }),
    prisma.authUser.count({ where })
  ]);

  return { users, total, pages: Math.ceil(total / limit) };
}

export async function updateUserSubscription(userId: number, tier: string) {
  await checkAdminAccess();
  await prisma.authUser.update({
    where: { id: userId },
    data: { subscriptionTier: tier }
  });
  revalidatePath("/admin");
}

export async function deleteUser(userId: number) {
  await checkAdminAccess();
  await prisma.authUser.delete({ where: { id: userId } });
  revalidatePath("/admin");
}

export async function toggleBanUser(userId: number) {
  await checkAdminAccess();
  const user = await prisma.authUser.findUnique({ where: { id: userId } });
  if (!user) return;

  const newStatus = user.subscriptionStatus === 'banned' ? 'incomplete' : 'banned';
  await prisma.authUser.update({
    where: { id: userId },
    data: { subscriptionStatus: newStatus }
  });
  revalidatePath("/admin");
}

export async function getDetailedRevenue() {
  await checkAdminAccess();

  // Subscription Revenue Estimate
  const tiers = await prisma.subscriptionTier.findMany();
  // If no tiers in DB, use hardcoded estimates
  const proUsers = await prisma.authUser.count({ where: { subscriptionTier: "pro" } });
  const premiumUsers = await prisma.authUser.count({ where: { subscriptionTier: "premium" } });
  
  // Calculate based on tiers if available, else usage default
  // Assuming 'pro' -> $10, 'premium' -> $20
  const monthlySubscriptionRevenue = (proUsers * 10) + (premiumUsers * 20);

  // Onetime Export Fees
  const paidExports = await prisma.batchSession.findMany({
    where: {
      status: 'completed',
      paidAt: { not: null }
    }
  });
  
  const exportRevenue = paidExports.length * 4; // $4 per export

  return {
    subscriptionRevenue: monthlySubscriptionRevenue,
    exportRevenue,
    totalRevenue: monthlySubscriptionRevenue + exportRevenue,
    exportCount: paidExports.length,
    proCount: proUsers,
    premiumCount: premiumUsers
  };
}

export async function getAllActivityLogs(page: number = 1, limit: number = 20) {
  await checkAdminAccess();
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true }
        }
      }
    }),
    prisma.auditLog.count()
  ]);

  return { logs, total, pages: Math.ceil(total / limit) };
}


