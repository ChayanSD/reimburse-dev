"use client";

import { useState, use, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import useUser from "@/utils/useUser";
import {
  Users,
  Receipt,
  FileText,
  Activity,
  TrendingUp,
  Eye,
  DollarSign,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Mail,
  Crown,
  Trash2,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// Type definitions
interface UserInfo {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  subscriptionTier: string | null;
  role: string;
  createdAt: string;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  trialStart: string | null;
  trialEnd: string | null;
  name: string;
}

interface UserStats {
  totalReceipts: number;
  totalAmount: number;
  receiptsThisPeriod: number;
  amountThisPeriod: number;
  totalReports: number;
  reportsThisPeriod: number;
  lastActivity: string | null;
}

interface ActivityItem {
  event: string;
  created_at: string;
  meta?: Record<string, unknown>;
}

interface CategoryItem {
  category: string | null;
  count: number;
  total: number;
}

interface ReceiptItem {
  id: string;
  merchantName: string | null;
  amount: number;
  category: string | null;
  receiptDate: string | null;
  createdAt: string;
  fileUrl: string | null;
}

interface UserDetailsResponse {
  user: UserInfo;
  stats: UserStats;
  recentActivity: ActivityItem[];
  categoryBreakdown: CategoryItem[];
  receipts: ReceiptItem[];
}

// Timeframe type
type Timeframe = "7d" | "30d" | "90d" | "all";

interface AdminUserDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

// API functions
const fetchUserDetails = async (userId: string, timeframe: Timeframe): Promise<UserDetailsResponse> => {
  const response = await axios.post<UserDetailsResponse>("/api/admin/user-details", {
    user_id: userId,
    timeframe,
  });
  return response.data;
};

const deleteReceipt = async (receiptId: string): Promise<void> => {
  await axios.post("/api/admin/delete-receipt", {
    receipt_id: receiptId,
  });
};

// Utility functions
const formatDate = (dateString: string | null): string => {
  if (!dateString) return "Never";
  return new Date(dateString).toLocaleString();
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0);
};

export default function AdminUserDetailPage({ params }: AdminUserDetailPageProps) {
  const { id } = use(params);
  const { data: currentUser, loading: userLoading } = useUser();
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("30d");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('button[aria-label="Toggle menu"]')
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Fetch user details with react-query
  const {
    data: userData,
    isLoading: loading,
    error,
    refetch: refetchUserData,
  } = useQuery<UserDetailsResponse, Error>({
    queryKey: ["adminUserDetails", id, selectedTimeframe],
    queryFn: () => fetchUserDetails(id, selectedTimeframe),
    enabled: !!currentUser?.id && !!id,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Delete receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: deleteReceipt,
    onSuccess: () => {
      // Invalidate and refetch user data
      queryClient.invalidateQueries({
        queryKey: ["adminUserDetails", id, selectedTimeframe]
      });
    },
    onError: (error: Error) => {
      console.error("Error deleting receipt:", error);
      alert("Failed to delete receipt");
    },
  });

  const handleDeleteReceipt = async (receiptId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this receipt? This action cannot be undone."
      )
    )
      return;

    deleteReceiptMutation.mutate(receiptId);
  };

  const handleRefresh = () => {
    refetchUserData();
  };

  // Loading states
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Authentication check
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Please sign in to access admin dashboard
          </p>
          <Link
            href="/account/signin"
            className="text-blue-600 hover:text-blue-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const errorMessage = error.message.includes("Access denied") 
      ? "Access denied. Admin privileges required."
      : "Failed to fetch user data";

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <p className="text-red-600 mb-4">{errorMessage}</p>
          <Link href="/admin" className="text-blue-600 hover:text-blue-700">
            Back to Admin Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="min-h-screen bg-[#F3F4F6]"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
      >
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 relative">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <Image
                src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
                alt="ReimburseMe Logo"
                className="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
                width={40}
                height={40}
              />
              <div className="min-w-0 flex-1">
                <h1
                  className="text-lg sm:text-xl font-bold text-gray-900"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  ReimburseMe
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">
                  Admin Dashboard - User Details
                </p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4 shrink-0">
              <select
                value={selectedTimeframe}
                onChange={(e) => setSelectedTimeframe(e.target.value as Timeframe)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="all">All Time</option>
              </select>
              <button
                onClick={handleRefresh}
                className="flex items-center gap-2 px-4 py-2 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-2xl transition-colors"
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-2xl transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Admin
              </Link>
              <Link
                href="/account/logout"
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                Sign Out
              </Link>
            </div>

            {/* Mobile Burger Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X size={24} />
              ) : (
                <Menu size={24} />
              )}
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div ref={mobileMenuRef} className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50">
              <div className="px-4 py-3 space-y-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 px-4">
                    Timeframe
                  </label>
                  <select
                    value={selectedTimeframe}
                    onChange={(e) => {
                      setSelectedTimeframe(e.target.value as Timeframe);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E86DE] focus:border-transparent"
                  >
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                    <option value="90d">Last 90 Days</option>
                    <option value="all">All Time</option>
                  </select>
                </div>
              <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                  onClick={() => {
                    handleRefresh();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2E86DE] hover:bg-[#2574C7] text-white font-medium rounded-lg transition-colors"
                  disabled={loading}
                >
                  <RefreshCw
                    size={18}
                    className={loading ? "animate-spin" : ""}
                  />
                  Refresh
                </button>
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                >
                  <ArrowLeft size={18} />
                  Back to Admin
                </Link>
              </div>
                <Link
                  href="/account/logout"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium rounded-lg transition-colors"
                >
                  <LogOut size={18} />
                  Sign Out
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {loading ? (
            <div className="space-y-6">
              {/* User Info Header Skeleton */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-200 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-full animate-pulse shrink-0"></div>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="h-6 sm:h-8 bg-gray-200 rounded-lg w-3/4 animate-pulse"></div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="h-4 sm:h-5 bg-gray-200 rounded-full w-48 animate-pulse"></div>
                        <div className="h-5 sm:h-6 bg-gray-200 rounded-full w-24 animate-pulse"></div>
                        <div className="h-5 sm:h-6 bg-gray-200 rounded-full w-16 animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                    <div className="h-5 sm:h-6 bg-gray-200 rounded w-12 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                  </div>
                </div>
              </div>

              {/* Statistics Cards Skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-white rounded-3xl p-6 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                        <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                      </div>
                      <div className="w-12 h-12 bg-gray-200 rounded-2xl animate-pulse"></div>
                    </div>
                    <div className="mt-4">
                      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Additional Content Skeleton */}
              <div className="bg-white rounded-3xl p-6 border border-gray-200">
                <div className="space-y-4">
                  <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-gray-200 rounded-lg animate-pulse"></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : !userData ? (
            <div className="text-center py-12">
              <div className="text-gray-600">User not found</div>
            </div>
          ) : (
            <>
              {/* User Info Header */}
              <div className="bg-white rounded-3xl p-4 sm:p-6 border border-gray-200 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#2E86DE] bg-opacity-10 rounded-full flex items-center justify-center shrink-0">
                      <Users className="text-[#2E86DE] w-6 h-6 sm:w-8 sm:h-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                        {userData.user.name ||
                          userData.user.email ||
                          `User ${userData.user.id}`}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Mail size={16} className="shrink-0" />
                          <span className="text-xs sm:text-sm truncate">{userData.user.email}</span>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full shrink-0 ${
                            userData.user.subscriptionTier === "pro" ||
                            userData.user.subscriptionTier === "premium"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {userData.user.subscriptionTier === "pro" ||
                            (userData.user.subscriptionTier === "premium" && (
                              <Crown size={14} className="mr-1 shrink-0" />
                            ))}
                          {userData.user.subscriptionTier || "free"} plan
                        </span>
                        {userData.user.role === "ADMIN" && (
                          <span className="inline-flex px-2 sm:px-3 py-1 text-xs sm:text-sm font-semibold rounded-full bg-purple-100 text-purple-800 shrink-0">
                            Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs sm:text-sm text-gray-500">User ID</p>
                    <p className="text-base sm:text-lg font-semibold text-gray-900">
                      {userData.user.id}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500 mt-2">
                      Joined{" "}
                      {userData.user.createdAt
                        ? new Date(
                            userData.user.createdAt,
                          ).toLocaleDateString()
                        : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              {/* User Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Receipts
                      </p>
                      <p className="text-3xl font-bold text-[#10B981]">
                        {userData.stats?.totalReceipts || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#10B981] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <Receipt className="text-[#10B981]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-green-600">
                      +{userData.stats?.receiptsThisPeriod || 0} this period
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Total Amount
                      </p>
                      <p className="text-3xl font-bold text-[#8B5CF6]">
                        {formatCurrency(userData.stats?.totalAmount)}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#8B5CF6] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <DollarSign className="text-[#8B5CF6]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-green-600">
                      {formatCurrency(userData.stats?.amountThisPeriod)} this
                      period
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Reports Generated
                      </p>
                      <p className="text-3xl font-bold text-[#F59E0B]">
                        {userData.stats?.totalReports || 0}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#F59E0B] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <FileText className="text-[#F59E0B]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-green-600">
                      +{userData.stats?.reportsThisPeriod || 0} this period
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Last Active
                      </p>
                      <p className="text-lg font-bold text-[#2E86DE]">
                        {userData.stats?.lastActivity
                          ? new Date(
                              userData.stats.lastActivity,
                            ).toLocaleDateString()
                          : "Never"}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-[#2E86DE] bg-opacity-10 rounded-2xl flex items-center justify-center">
                      <Activity className="text-[#2E86DE]" size={24} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-sm text-gray-600">
                      {userData.stats?.lastActivity
                        ? formatDate(userData.stats.lastActivity)
                        : "No activity"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Recent Activity */}
                <div className="bg-white rounded-3xl border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Recent Activity
                      </h2>
                      <Activity className="text-gray-400" size={20} />
                    </div>
                  </div>
                  <div className="p-6 max-h-96 overflow-y-auto">
                    {userData.recentActivity?.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        No recent activity
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {userData.recentActivity
                          ?.slice(0, 10)
                          .map((activity, index) => (
                            <div
                              key={index}
                              className="flex items-start space-x-3"
                            >
                              <div className="w-8 h-8 bg-[#2E86DE] bg-opacity-10 rounded-full flex items-center justify-center shrink-0">
                                <Activity
                                  className="text-[#2E86DE]"
                                  size={16}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">
                                  {activity.event}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatDate(activity.created_at)}
                                </p>
                                {activity.meta &&
                                  Object.keys(activity.meta).length > 0 && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {JSON.stringify(activity.meta)}
                                    </p>
                                  )}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white rounded-3xl border border-gray-200">
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        Category Breakdown
                      </h2>
                      <TrendingUp className="text-gray-400" size={20} />
                    </div>
                  </div>
                  <div className="p-6">
                    {userData.categoryBreakdown?.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        No expense data
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {userData.categoryBreakdown?.map((category, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-600">
                                  {category.category?.charAt(0) || "O"}
                                </span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {category.category || "Other"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {category.count} receipts
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">
                                {formatCurrency(category.total)}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(
                                  (category.total /
                                    userData.stats?.totalAmount) *
                                    100 || 0
                                ).toFixed(1)}
                                %
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* User Receipts */}
              <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold text-gray-900">
                    User Receipts
                  </h2>
                </div>
                {userData.receipts?.length === 0 ? (
                  <div className="p-6 text-center">
                    <p className="text-gray-500">No receipts found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Merchant
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Created
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {userData.receipts?.map((receipt) => (
                          <tr key={receipt.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {receipt.receiptDate || "N/A"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {receipt.merchantName || "Unknown"}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[#10B981]">
                              {formatCurrency(receipt.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-lg">
                                {receipt.category || "Other"}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(
                                receipt.createdAt,
                              ).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                {receipt.fileUrl && (
                                  <button
                                    onClick={() =>
                                      window.open(receipt.fileUrl || "", "_blank")
                                    }
                                    className="text-[#2E86DE] hover:text-[#2574C7] p-1"
                                    title="View Receipt"
                                  >
                                    <Eye size={16} />
                                  </button>
                                )}
                                <button
                                  onClick={() =>
                                    handleDeleteReceipt(receipt.id)
                                  }
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Delete Receipt (Admin)"
                                  disabled={deleteReceiptMutation.isPending}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}