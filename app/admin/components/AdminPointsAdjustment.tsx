"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";

interface BalanceInfo {
    userId: number;
    balance: { available: number; pending: number; lifetime: number };
    tier: { name: string; level: number };
}

export function AdminPointsAdjustment() {
    const [userId, setUserId] = useState("");
    const [points, setPoints] = useState("");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(false);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);

    const handleLookup = async () => {
        if (!userId) return;
        setLookupLoading(true);
        setMessage(null);
        try {
            const res = await axios.get(`/api/admin/rewards/adjust-points?userId=${userId}`);
            setBalanceInfo(res.data);
        } catch (err: any) {
            setMessage({ type: "error", text: err?.response?.data?.error || "Lookup failed" });
        } finally {
            setLookupLoading(false);
        }
    };

    const handleAdjust = async () => {
        if (!userId || !points || !note) {
            setMessage({ type: "error", text: "All fields are required" });
            return;
        }
        setLoading(true);
        setMessage(null);
        try {
            const res = await axios.post("/api/admin/rewards/adjust-points", {
                userId: parseInt(userId),
                points: parseInt(points),
                note,
            });
            setMessage({ type: "success", text: res.data.message });
            setPoints("");
            setNote("");
            // Re-fetch balance
            await handleLookup();
        } catch (err: any) {
            setMessage({ type: "error", text: err?.response?.data?.error || "Adjustment failed" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="rounded-xl border border-gray-200 bg-white">
            <CardHeader>
                <CardTitle className="text-base font-bold">Points Adjustment</CardTitle>
                <p className="text-xs text-gray-500">Manually credit or debit points for any user. Positive = credit, negative = debit.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* User Lookup */}
                <div className="flex gap-2">
                    <Input
                        placeholder="User ID"
                        type="number"
                        value={userId}
                        onChange={(e) => { setUserId(e.target.value); setBalanceInfo(null); }}
                        className="max-w-[140px]"
                    />
                    <Button variant="secondary" size="sm" onClick={handleLookup} disabled={lookupLoading || !userId}>
                        {lookupLoading ? "Looking up..." : "Look Up"}
                    </Button>
                </div>

                {/* Balance Info */}
                {balanceInfo && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm space-y-1">
                        <p><span className="font-semibold">Tier:</span> {balanceInfo.tier.name} (Level {balanceInfo.tier.level})</p>
                        <p><span className="font-semibold">Available:</span> {balanceInfo.balance.available.toLocaleString()} pts</p>
                        <p><span className="font-semibold">Pending:</span> {balanceInfo.balance.pending.toLocaleString()} pts</p>
                        <p><span className="font-semibold">Lifetime:</span> {balanceInfo.balance.lifetime.toLocaleString()} pts</p>
                    </div>
                )}

                {/* Adjustment Form */}
                <div className="space-y-2 pt-2 border-t border-gray-100">
                    <Input
                        placeholder="Points (e.g. 500 or -200)"
                        type="number"
                        value={points}
                        onChange={(e) => setPoints(e.target.value)}
                    />
                    <Input
                        placeholder="Admin note (reason for adjustment)"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                    <Button
                        onClick={handleAdjust}
                        disabled={loading || !userId || !points || !note}
                        className="w-full"
                        size="sm"
                    >
                        {loading ? "Adjusting..." : "Apply Adjustment"}
                    </Button>
                </div>

                {/* Result Message */}
                {message && (
                    <p className={`text-xs font-medium ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
                        {message.text}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
