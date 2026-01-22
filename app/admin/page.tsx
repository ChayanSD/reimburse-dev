
import { Metadata } from "next";
import { 
  checkAdminAccess, 
  getDashboardStats, 
  getUserGrowthData, 
  getRecentSignups, 
  getActivityLogs,
  getAllUsers,
  getDetailedRevenue,
  getAllActivityLogs
} from "./actions";
import { Overview } from "./components/Overview";
import { RecentSales } from "./components/RecentSales";
import { ActivityLog } from "./components/ActivityLog";
import { DateRangeFilter } from "./components/DateRangeFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, DollarSign, FileText, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminTabs } from "./components/AdminTabs";
import { UsersTable } from "./components/UsersTable";
import { DetailedRevenue } from "./components/DetailedRevenue";
import { ActivityTable } from "./components/ActivityTable";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard for Reimburse AI",
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await checkAdminAccess();
  
  const params = await searchParams;
  const days = typeof params.days === "string" ? parseInt(params.days) : 30;
  const tab = typeof params.tab === "string" ? params.tab : "overview";
  const page = typeof params.page === "string" ? parseInt(params.page) : 1;
  const search = typeof params.search === "string" ? params.search : "";

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage your application and view system statistics.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2 border-gray-200 hover:bg-gray-50 text-gray-700">
              <LayoutDashboard className="h-4 w-4" />
              User Dashboard
            </Button>
          </Link>
          {tab === 'overview' && <DateRangeFilter />}
        </div>
      </div>

      <AdminTabs />
      
      {tab === 'overview' && await OverviewTab({ days })}
      {tab === 'users' && await UsersTab({ page, search })}
      {tab === 'revenue' && await RevenueTab()}
      {tab === 'activity' && await ActivityTab({ page })}

    </div>
  );
}

// Sub-components for Server Side Rendering cleanly
async function OverviewTab({ days }: { days: number }) {
  const [stats, userGrowth, recentSignups, activityLogs] = await Promise.all([
    getDashboardStats(days),
    getUserGrowthData(days),
    getRecentSignups(),
    getActivityLogs()
  ]);

  const formattedRecentUsers = recentSignups.map((u: any) => ({
    id: u.id,
    name: (u.firstName && u.lastName) ? `${u.firstName} ${u.lastName}` : (u.firstName || u.lastName || "User"),
    email: u.email,
    subscriptionTier: u.subscriptionTier
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue (Est.)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.revenueChange > 0 ? "+" : ""}{stats.revenueChange}% from last period
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+{stats.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              Active accounts
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receipts Processed</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalReceipts.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.receiptsChange > 0 ? "+" : ""}{stats.receiptsChange}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OCR Success Rate</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.ocrSuccessRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
               Rate for selected period
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>
              New users over the last {days} days
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <Overview data={userGrowth} />
          </CardContent>
        </Card>
        
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
            <CardDescription>
              Latest users joined.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentSales users={formattedRecentUsers} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
             <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Latest system events and audit logs.
            </CardDescription>
          </CardHeader>
          <CardContent>
             <ActivityLog logs={activityLogs as any} /> 
          </CardContent>
        </Card>
         <Card className="col-span-3">
             <CardHeader>
            <CardTitle>Total Users</CardTitle>
             <CardTitle className="text-4xl font-bold">{stats.totalUsers.toLocaleString()}</CardTitle>
            <CardDescription>
               {stats.usersChange > 0 ? "+" : ""}{stats.usersChange}% since last period
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

async function UsersTab({ page, search }: { page: number, search: string }) {
  const data = await getAllUsers(page, 10, search);
  return (
    <UsersTable 
      users={data.users} 
      total={data.total} 
      pages={data.pages} 
      currentPage={page} 
    />
  );
}

async function RevenueTab() {
  const data = await getDetailedRevenue();
  return <DetailedRevenue data={data} />;
}

async function ActivityTab({ page }: { page: number }) {
  const data = await getAllActivityLogs(page, 20);
  return (
    <ActivityTable 
       logs={data.logs}
       total={data.total}
       pages={data.pages}
       currentPage={page}
    />
  );
}