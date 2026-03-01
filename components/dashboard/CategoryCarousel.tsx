"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CreateCategoryDialog } from "./CreateCategoryDialog";
import { Loader2, Trash2, Tag, Receipt, DollarSign, Download, FileSpreadsheet, FileText as FilePdf } from "lucide-react";
import { getCurrencySymbol } from "@/lib/utils";
import useUser from "@/utils/useUser";
import { generateCSV, downloadCSV } from "@/utils/csvGenerator";
import { pdf } from "@react-pdf/renderer";
import { ReimburseMePDFDocument } from "@/utils/reactPdfTemplates";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
import { useState } from "react";
import toast from "react-hot-toast";

interface UserCategory {
    id: string;
    title: string;
    description: string | null;
    receiptCount: number;
    totalSpend: number;
}

interface CategoryCarouselProps {
    onSelect?: (category: string) => void;
    selectedCategory?: string;
}

export function CategoryCarousel({ onSelect, selectedCategory }: CategoryCarouselProps) {
    const queryClient = useQueryClient();
    const { data: categories = [], isLoading, refetch } = useQuery<UserCategory[]>({
        queryKey: ["user-categories"],
        queryFn: async () => {
            const response = await axios.get("/api/categories");
            return response.data.categories;
        },
    });

    const { data: user } = useUser();
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [exportingId, setExportingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`/api/categories?categoryId=${id}`);
            toast.success("Category deleted");
            queryClient.invalidateQueries({ queryKey: ["user-categories"] });
            queryClient.invalidateQueries({ queryKey: ["receipts"] });
        } catch (err) {
            toast.error("Failed to delete category");
            console.error(err);
        } finally {
            setDeletingId(null);
        }
    };

    const handleExport = async (category: UserCategory, type: 'csv' | 'pdf') => {
        if (category.receiptCount === 0) {
            toast.error("No receipts to export in this category");
            return;
        }

        setExportingId(`${category.id}-${type}`);
        try {
            // Fetch receipts for this category
            const res = await axios.get(`/api/receipts?category=${encodeURIComponent(category.title)}&limit=1000`);
            const receipts = res.data.receipts;

            if (type === 'csv') {
                const csvContent = generateCSV(receipts, 'personal');
                const filename = `personal_${category.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
                downloadCSV(csvContent, filename);
                toast.success(`Exported ${receipts.length} receipts to CSV`);
            } else {
                const reportData = {
                    reportMeta: {
                        report_id: `USER-CAT-${category.id}-${Date.now()}`,
                        period_start: receipts[receipts.length - 1]?.receipt_date || new Date().toISOString(),
                        period_end: receipts[0]?.receipt_date || new Date().toISOString(),
                        generated_at: new Date().toISOString(),
                        currency: receipts[0]?.currency || "USD",
                    },
                    submitter: {
                        name: user?.name || user?.email || "User",
                        email: user?.email || "",
                    },
                    recipient: {
                        company_name: "Personal Expense Report",
                        approver_name: "Self",
                        approver_email: user?.email || "",
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
                        submitted_by: user?.name || "User",
                        file_url: r.file_url,
                    })),
                };

                const blob = await pdf(<ReimburseMePDFDocument data={reportData} />).toBlob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `personal_${category.title.replace(/\s+/g, '_')}_report.pdf`;
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

    if (isLoading) {
        return (
            <div className="w-full h-48 flex items-center justify-center border rounded-xl bg-white/50">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between px-1">
                <h2 className="text-lg font-semibold text-gray-900">Your Categories</h2>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{categories.length} Categories</span>
            </div>

            <ScrollArea className="w-full whitespace-nowrap rounded-xl">
                <div className="flex w-max space-x-3 sm:space-x-4 p-1 pb-4">
                    {/* Create New Card - Always First */}
                    <div className="w-[85vw] sm:w-[300px] shrink-0">
                        <CreateCategoryDialog />
                    </div>

                    {categories.map((category) => (
                        <div
                            key={category.id}
                            onClick={() => onSelect?.(selectedCategory === category.title ? "all" : category.title)}
                            className={`w-[85vw] sm:w-[300px] shrink-0 border rounded-xl p-5 hover:shadow-lg transition-all duration-200 group relative flex flex-col justify-between snap-start cursor-pointer ${selectedCategory === category.title
                                ? "bg-blue-50 border-blue-400 ring-2 ring-blue-100 shadow-md scale-[1.02]"
                                : "bg-white border-gray-200"
                                }`}
                        >
                            <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                                        <Tag className="w-5 h-5" />
                                    </div>
                                    <div className="flex gap-1">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                    disabled={!!exportingId && exportingId.startsWith(category.id)}
                                                >
                                                    {exportingId && exportingId.startsWith(category.id) ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Download className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
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

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => e.stopPropagation()}
                                                    // Mobile: Always visible (opacity-100)
                                                    // Desktop: Visible on hover (sm:opacity-0 sm:group-hover:opacity-100)
                                                    className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to delete "{category.title}"? This will not remove receipts, but they will no longer be associated with this custom category logic.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        onClick={() => handleDelete(category.id)}
                                                        className="bg-red-600 hover:bg-red-700"
                                                    >
                                                        Delete
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-900 truncate" title={category.title}>
                                        {category.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 line-clamp-2 mt-1 h-10 w-full whitespace-normal">
                                        {category.description || "No description provided"}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-700">
                                        {category.receiptCount}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 justify-end">
                                    {/* Estimate currency as USD for aggregate now */}
                                    <span className="text-sm font-bold text-gray-900">
                                        {getCurrencySymbol("USD")}{category.totalSpend.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="hidden sm:flex" />
            </ScrollArea>
        </div>
    );
}
