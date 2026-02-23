"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, Tag, Download, FileSpreadsheet, FileText as FilePdf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "react-hot-toast";
import { generateCSV, downloadCSV } from "@/utils/csvGenerator";
import { pdf } from "@react-pdf/renderer";
import { ReimburseMePDFDocument } from "@/utils/reactPdfTemplates";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Category {
    id: string;
    title: string;
    description: string | null;
    receiptCount: number;
    totalSpend: number;
}

interface TeamCategoryManagementProps {
    teamId: string;
    isAdmin: boolean;
}

export function TeamCategoryManagement({ teamId, isAdmin }: TeamCategoryManagementProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [exportingId, setExportingId] = useState<string | null>(null);
    const [team, setTeam] = useState<any>(null);

    useEffect(() => {
        const fetchTeam = async () => {
            try {
                const res = await fetch(`/api/teams/${teamId}`);
                if (res.ok) {
                    const data = await res.json();
                    setTeam(data.team);
                }
            } catch (error) {
                console.error("Error fetching team:", error);
            }
        };
        fetchTeam();
    }, [teamId]);

    const fetchCategories = async () => {
        try {
            const res = await fetch(`/api/teams/${teamId}/categories`);
            if (!res.ok) throw new Error("Failed to fetch categories");
            const data = await res.json();
            setCategories(data.categories);
        } catch (error) {
            console.error("Error fetching team categories:", error);
            toast.error("Failed to load team categories");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, [teamId]);

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        setIsCreating(true);
        try {
            const res = await fetch(`/api/teams/${teamId}/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newTitle, description: newDescription }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to create category");
            }

            toast.success("Category created successfully");
            setNewTitle("");
            setNewDescription("");
            setDialogOpen(false);
            fetchCategories();
        } catch (error: any) {
            toast.error(error.message || "Failed to create category");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteCategory = async (categoryId: string) => {
        try {
            const res = await fetch(`/api/teams/${teamId}/categories/${categoryId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to delete category");
            }

            toast.success("Category deleted");
            fetchCategories();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete category");
        }
    };

    const handleExport = async (category: Category, type: 'csv' | 'pdf') => {
        if (category.receiptCount === 0) {
            toast.error("No receipts to export in this category");
            return;
        }

        setExportingId(`${category.id}-${type}`);
        try {
            // 1. Fetch receipts for this category from this team
            const res = await fetch(`/api/receipts?teamId=${teamId}&category=${encodeURIComponent(category.title)}&limit=1000`);
            if (!res.ok) throw new Error("Failed to fetch receipts for export");
            const data = await res.json();
            const receipts = data.receipts;

            if (type === 'csv') {
                const csvContent = generateCSV(receipts, teamId);
                const filename = `team_${teamId}_${category.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
                downloadCSV(csvContent, filename);
                toast.success(`Exported ${receipts.length} receipts to CSV`);
            } else {
                // PDF Export logic similar to receipts page
                const reportData = {
                    reportMeta: {
                        report_id: `TEAM-CAT-${category.id}-${Date.now()}`,
                        period_start: receipts[receipts.length - 1]?.receipt_date || new Date().toISOString(),
                        period_end: receipts[0]?.receipt_date || new Date().toISOString(),
                        generated_at: new Date().toISOString(),
                        currency: team?.defaultCurrency || receipts[0]?.currency || "USD",
                    },
                    submitter: {
                        name: "Team Category Export",
                        email: category.title,
                    },
                    recipient: {
                        company_name: team?.name || `Team #${teamId}`,
                        approver_name: team?.owner ? `${team.owner.firstName || ""} ${team.owner.lastName || ""}`.trim() : "Admin",
                        approver_email: team?.owner?.email || "",
                    },
                    summary: {
                        total_reimbursable: receipts.reduce((sum: number, r: any) => sum + parseFloat(r.amount), 0),
                        non_reimbursable: 0,
                        totals_by_category: [{ category: category.title, amount: category.totalSpend }],
                    },
                    line_items: receipts.map((r: any) => ({
                        date: r.receipt_date,
                        merchant: r.merchant_name,
                        category: r.category,
                        amount: parseFloat(r.amount),
                        notes: r.note,
                        submitted_by: r.user_name,
                        file_url: r.file_url,
                    })),
                };

                const blob = await pdf(<ReimburseMePDFDocument data={reportData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `team_${teamId}_${category.title.replace(/\s+/g, '_')}_report.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Exported ${receipts.length} receipts to PDF`);
            }
        } catch (error: any) {
            console.error("Export Error:", error);
            toast.error(error.message || `Failed to export ${type.toUpperCase()}`);
        } finally {
            setExportingId(null);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="space-y-1">
                    <CardTitle>Team Categories</CardTitle>
                    <CardDescription>
                        Custom categories that OCR will use to classify team receipts.
                    </CardDescription>
                </div>
                {isAdmin && (
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="bg-[#2E86DE] hover:bg-[#2E86DE]/90">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Category
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Team Category</DialogTitle>
                                <DialogDescription>
                                    Add a specific category for this team. AI will learn to match receipts based on the description.
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCreateCategory} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g., Marketing Ads, Office Rent"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description & Keywords</Label>
                                    <Textarea
                                        id="description"
                                        placeholder="Specific keywords or description to help AI classification"
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                    />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isCreating}>
                                        {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Create Category
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#2E86DE]" />
                    </div>
                ) : categories.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed text-muted-foreground">
                        <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No team categories created yet.</p>
                        <p className="text-xs">Categories added here will be available to all team members.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {categories.map((category) => (
                            <div
                                key={category.id}
                                className="p-4 border rounded-lg flex items-start justify-between bg-white dark:bg-gray-900 group"
                            >
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-sm">{category.title}</h4>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {category.description || "No description"}
                                    </p>
                                    <div className="pt-2 flex gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                        <span>{category.receiptCount} Receipts</span>
                                        <span>•</span>
                                        <span>${category.totalSpend.toFixed(2)} Total</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-[#2E86DE]"
                                                disabled={!!exportingId && exportingId.startsWith(category.id)}
                                            >
                                                {exportingId && exportingId.startsWith(category.id) ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Download className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleExport(category, 'csv')}>
                                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                                Export as CSV
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleExport(category, 'pdf')}>
                                                <FilePdf className="w-4 h-4 mr-2" />
                                                Export as PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>

                                    {isAdmin && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete the "{category.title}" category?
                                                        Receipts already in this category will not be deleted, but they will
                                                        no longer be grouped under this category title.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDeleteCategory(category.id)}
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
