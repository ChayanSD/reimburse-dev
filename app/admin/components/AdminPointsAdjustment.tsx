"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, UserSearch, History, Mail, AlertCircle, CheckCircle2, Search } from "lucide-react";
import axios from "axios";
import { format } from "date-fns";

interface UserResult {
    id: number;
    email: string;
    firstName: string | null;
    lastName: string | null;
}

interface BalanceInfo {
    userId: number;
    user: UserResult;
    balance: { available: number; pending: number; lifetime: number };
    tier: { name: string; level: number };
    recentHistory: any[];
}

export function AdminPointsAdjustment() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserResult[]>([]);
    const [points, setPoints] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);

    // Fuzzy search for users as admin types
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }
            setSearchLoading(true);
            try {
                const res = await axios.get(`/api/admin/rewards/adjust-points?search=${searchQuery}`);
                setSearchResults(res.data.users || []);
            } catch (err) {
                console.error("Search failed", err);
            } finally {
                setSearchLoading(false);
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const selectUser = async (userId: number) => {
        setSearchResults([]);
        setSearchQuery("");
        setSearchLoading(true);
        setMessage(null);
        try {
            const res = await axios.get(`/api/admin/rewards/adjust-points?userId=${userId}`);
            setBalanceInfo(res.data);
        } catch (err: any) {
            setMessage({ type: "error", text: err?.response?.data?.error || "Lookup failed" });
            setBalanceInfo(null);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAdjust = async () => {
        if (!balanceInfo || !points || !note) {
            setMessage({ type: "error", text: "All fields are required" });
            return;
        }

        const pts = parseInt(points);

        setLoading(true);
        setMessage(null);
        try {
            const res = await axios.post("/api/admin/rewards/adjust-points", {
                userId: balanceInfo.userId,
                points: pts,
                note,
            });
            setMessage({ type: "success", text: res.data.message });
            setPoints("");
            setNote("");
            // Refresh detailed info
            await selectUser(balanceInfo.userId);
        } catch (err: any) {
            setMessage({ type: "error", text: err?.response?.data?.error || "Adjustment failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Coins className="h-5 w-5 text-amber-500" />
                        <CardTitle>Credit Points</CardTitle>
                    </div>
                    <CardDescription>
                        Manually credit points to any user. Users will be notified via email automatically.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 relative">
                    {/* User Search Input */}
                    <div className="space-y-2 relative">
                        <label className="text-sm font-medium text-gray-700">Find User</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                                placeholder="Search by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                            {searchLoading && !balanceInfo && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                </div>
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg shadow-gray-200/50">
                                <ul className="max-h-60 overflow-auto py-1">
                                    {searchResults.map((u) => (
                                        <li
                                            key={u.id}
                                            onClick={() => selectUser(u.id)}
                                            className="cursor-pointer px-4 py-2 hover:bg-gray-50 flex flex-col"
                                        >
                                            <span className="text-sm font-semibold">{u.firstName} {u.lastName}</span>
                                            <span className="text-xs text-gray-500">{u.email}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Selected User & Balance */}
                    {balanceInfo && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-tight">Active User</span>
                                    <span className="text-sm font-black text-blue-900">{balanceInfo.user.firstName} {balanceInfo.user.lastName}</span>
                                    <span className="text-xs text-blue-700">{balanceInfo.user.email}</span>
                                </div>
                                <Button size="sm" variant="ghost" className="text-blue-600 text-[10px]" onClick={() => setBalanceInfo(null)}>Change</Button>
                            </div>

                            <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 border border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Current Balance</p>
                                    <p className="text-2xl font-black text-gray-900">{balanceInfo.balance.available.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">pts</span></p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">User Tier</p>
                                    <Badge variant="outline" className="mt-1 bg-white border-blue-200 text-blue-700">
                                        {balanceInfo.tier.name}
                                    </Badge>
                                </div>
                            </div>

                            {/* Adjustment Fields */}
                            <div className="space-y-4 pt-2 border-t border-gray-100">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Points to Credit</label>
                                    <Input
                                        placeholder="e.g. 500"
                                        type="number"
                                        min="1"
                                        value={points}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "" || parseInt(val) >= 0) {
                                                setPoints(val);
                                            }
                                        }}
                                        className="font-mono text-lg"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Notification Note</label>
                                    <Input
                                        placeholder="Reason for crediting (e.g. Early adopter bonus)"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                    <p className="text-[10px] text-gray-500 flex items-center gap-1 italic">
                                        <Mail className="h-3 w-3" /> Sent via email to user
                                    </p>
                                </div>
                                <Button
                                    onClick={handleAdjust}
                                    disabled={loading || !points || parseInt(points) <= 0 || !note}
                                    className="w-full bg-[#2E86DE] hover:bg-[#2574C7] text-white font-bold h-11 transition-all active:scale-95"
                                >
                                    {loading ? "Processing..." : "Credit Points"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {!balanceInfo && !searchLoading && searchQuery.length < 2 && (
                        <div className="py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                            <UserSearch className="h-10 w-10 mb-2 opacity-10" />
                            <p className="text-sm opacity-60">Begin typing to find a user</p>
                        </div>
                    )}

                    {/* Feedback */}
                    {message && (
                        <div className={`p-3 rounded-lg flex items-start gap-3 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                            {message.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                            <p className="text-sm font-medium">{message.text}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* History Column */}
            <Card className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-gray-500" />
                        <CardTitle className="text-lg">Points History</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto max-h-[600px]">
                    {!balanceInfo ? (
                        <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-gray-400">
                            <History className="h-12 w-12 mb-2 opacity-20" />
                            <p className="text-sm">User history will appear here once selected.</p>
                        </div>
                    ) : balanceInfo.recentHistory.length === 0 ? (
                        <div className="p-12 text-center text-gray-500 italic">
                            No transactions yet for this user.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {balanceInfo.recentHistory.map((item) => (
                                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="space-y-0.5">
                                            <p className="font-bold text-gray-900 text-sm">{item.source.replace(/_/g, ' ')}</p>
                                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-tighter">{format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a')}</p>
                                        </div>
                                        <div className={`text-sm font-black flex items-center gap-1 ${item.points > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {item.points > 0 ? '+' : ''}{item.points}
                                            <span className="text-[10px] font-normal opacity-70">pts</span>
                                        </div>
                                    </div>
                                    {item.note && (
                                        <div className="mt-2 text-[11px] leading-relaxed text-gray-600 bg-gray-100/50 p-2 rounded-md border border-gray-100">
                                            <span className="font-bold uppercase text-[9px] text-gray-400 mr-1">Note:</span>
                                            {item.note}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
