"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
    Gift,
    Star,
    Trophy,
    Copy,
    Check,
    ChevronRight,
    Zap,
    TrendingUp,
    Award,
    Share2,
    ShoppingBag,
    Clock,
    ArrowLeft,
    User,
    Menu,
    X,
    FileText,
    Settings,
    Shield,
    Users,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import useUser from "@/utils/useUser";

// ── Types ──────────────────────────────────────────────────

interface PointsBalance {
    available: number;
    pending: number;
    lifetime: number;
}

interface LedgerEntry {
    id: number;
    type: string;
    status: string;
    points: number;
    source: string;
    sourceId: string | null;
    note: string | null;
    createdAt: string;
}

interface ReferralStats {
    code: string;
    link: string;
    totalReferrals: number;
    activeReferrals: number;
    totalPointsEarned: number;
}

interface Mission {
    id: string;
    key: string;
    title: string;
    description: string | null;
    points: number;
    sortOrder: number;
    completed: boolean;
    completedAt: string | null;
}

interface TierInfo {
    level: number;
    name: string;
    minPoints: number;
    lifetimePoints: number;
    nextTierAt: number | null;
    nextTierName: string | null;
    progress: number;
}

interface RewardItem {
    id: number;
    title: string;
    description: string | null;
    pointsCost: number;
    rewardType: string;
    rewardValue: Record<string, unknown>;
    minTier: number;
    sortOrder: number;
    canRedeem: boolean;
}

// ── Tier Config ────────────────────────────────────────────

const TIER_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
    Bronze: { color: "text-amber-600", icon: "🥉", bg: "bg-amber-50 border-amber-100" },
    Silver: { color: "text-slate-500", icon: "🥈", bg: "bg-slate-50 border-slate-100" },
    Gold: { color: "text-yellow-600", icon: "🥇", bg: "bg-yellow-50 border-yellow-100" },
    Platinum: { color: "text-cyan-600", icon: "💎", bg: "bg-cyan-50 border-cyan-100" },
    Diamond: { color: "text-violet-600", icon: "👑", bg: "bg-violet-50 border-violet-100" },
    Ambassador: { color: "text-rose-600", icon: "🚀", bg: "bg-rose-50 border-rose-100" },
};

// ── Source Label Map ────────────────────────────────────────

function getSourceLabel(source: string): string {
    const map: Record<string, string> = {
        signup_referral: "Referral Signup",
        referral_signup: "Referral Signup",
        referral_paid_sub_pro: "Referral: Pro Subscription",
        referral_paid_sub_premium: "Referral: Premium Subscription",
        referral_retention_30d: "Referral: 30-Day Retention",
        referral_retention_90d: "Referral: 90-Day Retention",
        mission_first_upload: "Mission: First Upload",
        mission_connect_email: "Mission: Connect Email",
        mission_first_export: "Mission: First Export",
        mission_invite_team: "Mission: Invite Team",
        admin: "Admin Adjustment",
        redemption: "Reward Redeemed",
    };
    return map[source] || source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

// ══════════════════════════════════════════════════════════
// PAGE COMPONENT
// ══════════════════════════════════════════════════════════

export default function RewardsPage() {
    const { data: user } = useUser();
    const [balance, setBalance] = useState<PointsBalance | null>(null);
    const [history, setHistory] = useState<LedgerEntry[]>([]);
    const [referral, setReferral] = useState<ReferralStats | null>(null);
    const [missions, setMissions] = useState<Mission[]>([]);
    const [tier, setTier] = useState<TierInfo | null>(null);
    const [catalog, setCatalog] = useState<RewardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [redeemingId, setRedeemingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<"overview" | "missions" | "rewards" | "history">("overview");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    const fetchAll = useCallback(async () => {
        try {
            setLoading(true);
            const [pointsRes, referralRes, missionsRes, tierRes, catalogRes] = await Promise.all([
                axios.get("/api/rewards/points"),
                axios.get("/api/rewards/referral"),
                axios.get("/api/rewards/missions"),
                axios.get("/api/rewards/tiers"),
                axios.get("/api/rewards/catalog"),
            ]);
            setBalance(pointsRes.data.balance);
            setHistory(pointsRes.data.history);
            setReferral(referralRes.data.referral);
            setMissions(missionsRes.data.missions);
            setTier(tierRes.data.tier);
            setCatalog(catalogRes.data.rewards);
        } catch (err) {
            console.error("Failed to load rewards data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const copyReferralLink = () => {
        if (referral?.link) {
            navigator.clipboard.writeText(referral.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleRedeem = async (rewardId: number) => {
        setRedeemingId(rewardId);
        try {
            await axios.post("/api/rewards/redeem", { rewardId });
            await fetchAll();
        } catch (err: any) {
            console.error("Redeem failed:", err?.response?.data?.error || err.message);
        } finally {
            setRedeemingId(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground text-sm font-medium">Loading rewards...</p>
            </div>
        );
    }

    const tierInfo = TIER_CONFIG[tier?.name || "Bronze"] || TIER_CONFIG.Bronze;

    return (
        <div className="min-h-screen bg-[#F3F4F6] transition-colors">
            {/* Header Aligned with Dashboard */}
            <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                    <div className="flex justify-between items-center">
                        {/* Logo and App Name */}
                        <div className="flex items-center gap-3">
                            <Image
                                src="https://ucarecdn.com/6b43f5cf-10b4-4838-b2ba-397c0a896734/-/format/auto/"
                                alt="ReimburseMe"
                                className="w-8 h-8 sm:w-10 sm:h-10 shrink-0"
                                height={40}
                                width={40}
                            />
                            <div className="min-w-0 flex-1">
                                <h1
                                    className="text-lg sm:text-x font-bold text-gray-900"
                                    style={{ fontFamily: 'Poppins, sans-serif' }}
                                >
                                    ReimburseMe
                                </h1>
                                <p className="text-xs sm:text-sm text-gray-600">
                                    {(user as any)?.name || (user as any)?.email || ""}
                                </p>
                            </div>
                        </div>

                        {/* Back to Dashboard & Mobile Toggle */}
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="sm" asChild className="hidden md:flex rounded-2xl gap-2 font-semibold">
                                <Link href="/dashboard">
                                    <ArrowLeft size={16} />
                                    Back to Dashboard
                                </Link>
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                className="md:hidden"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            >
                                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                            </Button>

                            <div className="hidden md:flex w-10 h-10 bg-[#2E86DE]/10 rounded-full items-center justify-center border border-[#2E86DE]/20">
                                <User size={20} className="text-[#2E86DE]" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div ref={mobileMenuRef} className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-50 px-4 py-3 space-y-2">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 border border-gray-100"
                        >
                            <ArrowLeft size={20} />
                            Dashboard
                        </Link>
                        <Link
                            href="/profile"
                            className="flex items-center gap-3 px-4 py-3 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 border border-gray-100"
                        >
                            <User size={20} />
                            My Profile
                        </Link>
                        <Link
                            href="/rewards"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-violet-600 bg-violet-50 font-bold rounded-lg transition-colors border border-violet-100"
                        >
                            <Gift size={20} />
                            Rewards & Referrals
                        </Link>
                    </div>
                )}
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="flex flex-col lg:flex-row gap-6">

                    {/* Sidebar: Profile & Tier */}
                    <div className="w-full lg:w-80 space-y-4 shrink-0">
                        <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white">
                            <CardContent className="pt-8 flex flex-col items-center">
                                <div className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4 border font-bold text-xs", tierInfo.bg, tierInfo.color)}>
                                    <span>{tierInfo.icon}</span>
                                    <span>{tier?.name || "Bronze"} TIER</span>
                                </div>
                                <div className="text-center mb-6">
                                    <h2 className="text-4xl font-bold text-gray-900">
                                        {balance?.available.toLocaleString() || 0}
                                    </h2>
                                    <p className="text-gray-500 text-xs font-semibold mt-1 uppercase tracking-wide">Available Balance</p>
                                </div>

                                <div className="w-full space-y-3 pt-4 border-t border-gray-100">
                                    <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400">
                                        <span>Progress to next tier</span>
                                        <span>{tier?.progress || 0}%</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div
                                            className="h-2 rounded-full bg-[#2E86DE] transition-all duration-1000"
                                            style={{ width: `${tier?.progress || 0}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-center text-gray-500 font-medium leading-relaxed px-2">
                                        {tier?.nextTierName ? (
                                            <>Need <span className="text-gray-900 font-bold">{((tier.nextTierAt || 0) - tier.lifetimePoints).toLocaleString()} points</span> to reach <span className="text-[#2E86DE] font-bold">{tier.nextTierName}</span></>
                                        ) : "Maximum tier achieved!"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white p-4 text-center">
                                <p className="text-xl font-bold text-gray-900">{balance?.pending.toLocaleString() || 0}</p>
                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wide mt-1">Pending</p>
                            </Card>
                            <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white p-4 text-center">
                                <p className="text-xl font-bold text-gray-900">{balance?.lifetime.toLocaleString() || 0}</p>
                                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wide mt-1">Lifetime</p>
                            </Card>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 space-y-6">

                        {/* Tab Switcher */}
                        <div className="flex p-1 bg-white rounded-xl border border-gray-200 w-fit">
                            {(["overview", "missions", "rewards", "history"] as const).map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize",
                                        activeTab === tab
                                            ? "bg-gray-100 text-gray-900"
                                            : "text-gray-500 hover:text-gray-700"
                                    )}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        {/* ── OVERVIEW TAB ── */}
                        {activeTab === "overview" && (
                            <div className="space-y-6">
                                {/* Referral Banner Card */}
                                <Card className="rounded-2xl border border-gray-200 shadow-sm bg-white overflow-hidden">
                                    <div className="px-6 py-8 sm:px-10">
                                        <div className="flex items-center gap-2 text-violet-600 mb-6">
                                            <Share2 size={20} />
                                            <span className="text-xs font-bold uppercase tracking-wider">Referral Program</span>
                                        </div>
                                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 tracking-tight">
                                            Refer Friends & Earn Up to 3,300 Points
                                        </h2>
                                        <p className="text-gray-600 text-base mb-2 max-w-lg">
                                            Earn points through paid conversions and retention milestones:
                                        </p>
                                        <ul className="text-gray-600 text-sm mb-6 space-y-1 list-disc list-inside">
                                            <li>Referral becomes Pro subscriber ($9/mo): <span className="text-gray-900 font-bold">600 pts</span></li>
                                            <li>Referral becomes Premium subscriber ($15/mo): <span className="text-gray-900 font-bold">1000 pts</span></li>
                                            <li>Referral remains subscribed 30 days: <span className="text-gray-900 font-bold">800 pts</span></li>
                                            <li>Referral remains subscribed 90 days: <span className="text-gray-900 font-bold">1500 pts</span></li>
                                        </ul>

                                        <div className="flex flex-col sm:flex-row gap-3 mb-10">
                                            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-sm text-gray-700 truncate flex items-center">
                                                {referral?.link || "Loading link..."}
                                            </div>
                                            <Button
                                                onClick={copyReferralLink}
                                                className="bg-[#2E86DE] hover:bg-[#2574C7] text-white rounded-xl h-auto py-3 px-6 font-bold"
                                            >
                                                {copied ? <Check size={18} /> : <Copy size={18} />}
                                                {copied ? "Copied" : "Copy Link"}
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-100">
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{referral?.totalReferrals || 0}</p>
                                                <p className="text-[10px] font-bold uppercase text-gray-400">Total Invites</p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{referral?.activeReferrals || 0}</p>
                                                <p className="text-[10px] font-bold uppercase text-gray-400">Active Users</p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{(referral?.totalPointsEarned || 0).toLocaleString()}</p>
                                                <p className="text-[10px] font-bold uppercase text-gray-400">Points Earned</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                {/* Pending Missions Preview */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-bold text-gray-900 px-1">Unlock More Points</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {missions.filter(m => !m.completed).slice(0, 2).map(m => (
                                            <Card key={m.id} className="rounded-xl border border-gray-200 shadow-sm bg-white p-5 cursor-pointer hover:border-[#2E86DE] transition-colors" onClick={() => setActiveTab("missions")}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-gray-900">{m.title}</h4>
                                                        <p className="text-[11px] text-gray-500 mt-1">{m.description}</p>
                                                    </div>
                                                    <span className="text-xs font-bold text-[#2E86DE] bg-[#2E86DE]/5 px-2 py-1 rounded-lg">+{m.points}</span>
                                                </div>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── MISSIONS TAB ── */}
                        {activeTab === "missions" && (
                            <div className="space-y-3">
                                {missions.map((m) => (
                                    <Card key={m.id} className={cn(
                                        "rounded-xl border border-gray-200 shadow-sm p-4 flex items-center justify-between gap-4 bg-white",
                                        m.completed && "opacity-60 bg-gray-50/50"
                                    )}>
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                m.completed ? "bg-green-50 text-green-600" : "bg-[#2E86DE]/5 text-[#2E86DE]"
                                            )}>
                                                {m.completed ? <Check size={20} /> : <Trophy size={20} />}
                                            </div>
                                            <div>
                                                <h4 className={cn("text-sm font-bold", m.completed && "line-through opacity-70")}>{m.title}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "text-xs font-bold px-3 py-1.5 rounded-lg shrink-0",
                                            m.completed ? "text-green-600" : "text-[#2E86DE] bg-[#2E86DE]/5"
                                        )}>
                                            {m.completed ? "Completed" : `+${m.points} Pts`}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* ── REWARDS TAB ── */}
                        {activeTab === "rewards" && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {catalog.map((reward) => (
                                    <Card key={reward.id} className={cn(
                                        "rounded-2xl border border-gray-200 shadow-sm flex flex-col h-full bg-white",
                                        !reward.canRedeem && "opacity-70 bg-gray-50/50"
                                    )}>
                                        <CardHeader className="p-6">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600">
                                                    <ShoppingBag size={24} />
                                                </div>
                                                {reward.minTier > 1 && (
                                                    <span className="text-[10px] font-bold uppercase text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                                                        Tier {reward.minTier}+
                                                    </span>
                                                )}
                                            </div>
                                            <CardTitle className="text-lg font-bold">{reward.title}</CardTitle>
                                            <CardDescription className="text-xs pt-1">{reward.description}</CardDescription>
                                        </CardHeader>
                                        <div className="flex-1" />
                                        <CardFooter className="p-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                                            <div>
                                                <span className="text-lg font-bold text-gray-900">{reward.pointsCost.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">pts</span>
                                            </div>
                                            <Button
                                                disabled={!reward.canRedeem || redeemingId === reward.id}
                                                onClick={() => handleRedeem(reward.id)}
                                                className="rounded-xl font-bold h-9 px-4 text-xs"
                                            >
                                                {redeemingId === reward.id ? "Redeeming..." : "Redeem"}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        )}

                        {/* ── HISTORY TAB ── */}
                        {activeTab === "history" && (
                            <Card className="rounded-2xl border border-gray-200 shadow-sm overflow-hidden bg-white">
                                {history.length > 0 ? (
                                    <div className="divide-y divide-gray-100">
                                        {history.map((entry) => (
                                            <div key={entry.id} className="flex items-center justify-between px-6 py-5 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                                        entry.type === "earn" ? "bg-green-50 text-green-600" :
                                                            entry.type === "spend" ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                                                    )}>
                                                        {entry.type === "earn" ? <TrendingUp size={20} /> :
                                                            entry.type === "spend" ? <ShoppingBag size={20} /> : <Award size={20} />}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-900">{getSourceLabel(entry.source)}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{new Date(entry.createdAt).toLocaleDateString()}</span>
                                                            <span className="w-1 h-1 rounded-full bg-gray-200" />
                                                            <span className={cn(
                                                                "text-[10px] font-bold uppercase",
                                                                entry.status === "available" ? "text-green-600" :
                                                                    entry.status === "pending" ? "text-amber-500" : "text-gray-400"
                                                            )}>
                                                                {entry.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={cn(
                                                    "text-lg font-bold",
                                                    (entry.type === "earn" || entry.type === "adjustment") ? "text-green-600" : "text-red-500"
                                                )}>
                                                    {(entry.type === "earn" || entry.type === "adjustment") ? "+" : "−"}{entry.points.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-20 text-center">
                                        <Clock size={40} className="mx-auto text-gray-200 mb-3" />
                                        <p className="text-gray-400 font-bold text-xs uppercase tracking-wide">No points history</p>
                                    </div>
                                )}
                            </Card>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
