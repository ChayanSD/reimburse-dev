"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { CreateCategoryDialog } from "./CreateCategoryDialog";
import { Loader2, Trash2, Tag, Receipt, DollarSign } from "lucide-react";
import { getCurrencySymbol } from "@/lib/utils";
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
    const { data: categories = [], isLoading, refetch } = useQuery<UserCategory[]>({
        queryKey: ["user-categories"],
        queryFn: async () => {
            const response = await axios.get("/api/categories");
            return response.data.categories;
        },
    });

    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        try {
            await axios.delete(`/api/categories?categoryId=${id}`);
            toast.success("Category deleted");
            refetch();
        } catch (err) {
            toast.error("Failed to delete category");
            console.error(err);
        } finally {
            setDeletingId(null);
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
                                    {/* Delete Option (Hover) */}
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
                                        <AlertDialogContent>
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
