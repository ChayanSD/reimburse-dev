"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import { SUPPORTED_CURRENCIES } from "@/lib/constants/currencies";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "@/components/ui/alert-dialog";

import { TeamCategoryManagement } from "@/components/teams/TeamCategoryManagement";

export default function TeamSettingsPage() {
    const { teamId } = useParams();
    const router = useRouter();
    const [teamName, setTeamName] = useState("");
    const [teamCurrency, setTeamCurrency] = useState("USD");
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState("");

    useEffect(() => {
        const fetchTeam = async () => {
            try {
                const res = await fetch(`/api/teams/${teamId}`);
                if (!res.ok) throw new Error("Failed to load team");
                const data = await res.json();
                setTeamName(data.team.name);
                setTeamCurrency(data.team.defaultCurrency || "USD");
                setRole(data.role);
            } catch (error) {
                toast.error("Error loading team settings");
            } finally {
                setLoading(false);
            }
        };
        fetchTeam();
    }, [teamId]);

    const handleUpdateSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await fetch(`/api/teams/${teamId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: teamName,
                    default_currency: teamCurrency
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to update settings");
            }

            toast.success("Team settings updated");
        } catch (error: any) {
            toast.error(error.message || "Failed to update team settings");
        }
    };

    const handleDeleteTeam = async () => {
        try {
            const res = await fetch(`/api/teams/${teamId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to delete team");
            }

            toast.success("Team deleted successfully");
            router.push("/dashboard");
        } catch (error: any) {
            toast.error(error.message || "Failed to delete team");
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E86DE]"></div>
        </div>
    );

    const isOwner = role === "OWNER";
    const isAdmin = role === "OWNER" || role === "ADMIN";

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Team Settings</h1>
                <p className="text-muted-foreground">Manage your team workspace and configurations.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Team Profile</CardTitle>
                    <CardDescription>Update your team's name and currency.</CardDescription>
                </CardHeader>
                <form onSubmit={handleUpdateSettings}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="teamName">Team Name</Label>
                            <Input
                                id="teamName"
                                value={teamName}
                                onChange={(e) => setTeamName(e.target.value)}
                                disabled={!isOwner}
                                placeholder="Enter team name"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="currency">Default Currency</Label>
                            <select
                                id="currency"
                                value={teamCurrency}
                                onChange={(e) => setTeamCurrency(e.target.value)}
                                disabled={!isOwner}
                                className="w-full h-10 px-3 py-2 text-sm border rounded-md"
                            >
                                {SUPPORTED_CURRENCIES.map((currency) => (
                                    <option key={currency.code} value={currency.code}>
                                        {currency.code} - {currency.name} ({currency.symbol})
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-muted-foreground">
                                This currency will be used for all reports and batch exports generated for this team.
                            </p>
                            {!isOwner && (
                                <p className="text-xs text-muted-foreground">Only the team owner can change these settings.</p>
                            )}
                        </div>
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4 flex justify-end bg-muted/20">
                        <Button type="submit" disabled={!isOwner} className="px-8 bg-[#2E86DE] hover:bg-[#2E86DE]/90">
                            Save Changes
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            <TeamCategoryManagement teamId={teamId as string} isAdmin={isAdmin} />

            {isOwner && (
                <Card className="border-destructive/30 overflow-hidden">
                    <CardHeader className="bg-destructive/5">
                        <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        <CardDescription>Actions that cannot be undone. Please proceed with caution.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <h4 className="font-semibold text-foreground">Delete Team Workspace</h4>
                                <p className="text-sm text-muted-foreground">
                                    Permanently delete this team and all its data (receipts, reports, members).
                                </p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" className="shrink-0">
                                        Delete Team
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription className="space-y-2">
                                            <p>This action <strong>cannot be undone</strong>. This will permanently delete the
                                                <span className="font-semibold text-foreground"> {teamName}</span> workspace and remove all data associated with it.</p>
                                            <p className="text-destructive font-medium">All uploaded receipts and generated reports for this team will be lost forever.</p>
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteTeam} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                            Yes, delete everything
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
