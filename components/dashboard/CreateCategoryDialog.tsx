"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Plus, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"
import toast from "react-hot-toast";

export function CreateCategoryDialog() {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const queryClient = useQueryClient();

    const createCategoryMutation = useMutation({
        mutationFn: async (data: { title: string; description: string }) => {
            const response = await axios.post("/api/categories", data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["user-categories"] });
            toast.success("Category created successfully!");
            setOpen(false);
            setTitle("");
            setDescription("");
        },
        onError: (error) => {
            console.error("Failed to create category:", error);
            toast.error("Failed to create category. Please try again.");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        createCategoryMutation.mutate({ title, description });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-all cursor-pointer h-full min-h-[160px] group">
                    <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900">Add New Category</h3>
                    <p className="text-xs text-center text-gray-500 mt-1 px-4">
                        Train AI to recognize your specific expenses
                    </p>
                </div>
            </DialogTrigger>
            <DialogContent className="w-[95vw] rounded-xl sm:w-full sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Category</DialogTitle>
                    <DialogDescription>
                        Add a custom category. The AI will learn from the description to automatically classify future receipts.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Category Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Tech Conference, Team Lunch"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description & Keywords</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe what kind of receipts belong here. e.g., 'Tickets and accommodation for technology conferences'"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                        <p className="text-xs text-gray-500">
                            Be specific! The AI uses this to match your receipts.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={createCategoryMutation.isPending}>
                            {createCategoryMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                "Create Category"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
