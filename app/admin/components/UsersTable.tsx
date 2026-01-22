"use client";

import { useState, useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Search, Ban, CheckCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { deleteUser, toggleBanUser, updateUserSubscription } from "../actions";

export function UsersTable({ users, total, pages, currentPage }: any) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const tab = searchParams.get("tab") || "users";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/admin?tab=${tab}&search=${search}&page=1`);
  };

  const handleDelete = (id: number) => {
    if(!confirm("Are you sure?")) return;
    startTransition(async () => {
        await deleteUser(id);
    });
  };

   const handleBan = (id: number) => {
    startTransition(async () => {
        await toggleBanUser(id);
    });
  };

  const handleSubChange = (id: number, tier: string) => {
      startTransition(async () => {
        await updateUserSubscription(id, tier);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">All Users ({total})</h2>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input 
              placeholder="Search users..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" variant="secondary"><Search className="w-4 h-4" /></Button>
          </form>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user: any) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.firstName} {user.lastName}</div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>
                  {user.subscriptionStatus === 'banned' ? (
                    <span className="text-red-500 font-medium flex items-center gap-1 text-xs px-2 py-1 bg-red-50 rounded-full w-fit"><Ban className="w-3 h-3"/> Banned</span>
                  ) : (
                    <span className="text-green-600 flex items-center gap-1 text-xs px-2 py-1 bg-green-50 rounded-full w-fit"><CheckCircle className="w-3 h-3"/> Active</span>
                  )}
                </TableCell>
                <TableCell>{user.role}</TableCell>
                <TableCell className="capitalize">{user.subscriptionTier}</TableCell>
                <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                       <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Subscription</div>
                      <DropdownMenuItem onClick={() => handleSubChange(user.id, 'free')}>Set Free</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSubChange(user.id, 'pro')}>Set Pro</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleSubChange(user.id, 'premium')}>Set Premium</DropdownMenuItem>
                      <div className="h-px bg-gray-100 my-1"/>
                      <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => handleBan(user.id)}>
                        {user.subscriptionStatus === 'banned' ? "Unban User" : "Ban User"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => handleDelete(user.id)}>
                        Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
       {/* Pagination controls simplified */}
       <div className="flex items-center justify-between py-4">
         <div className="text-sm text-muted-foreground">
            Page {currentPage} of {pages}
         </div>
        <div className="flex justify-end gap-2">
            <Button 
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => router.push(`/admin?tab=${tab}&search=${search}&page=${currentPage-1}`)}
            >Previous</Button>
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pages}
                onClick={() => router.push(`/admin?tab=${tab}&search=${search}&page=${currentPage+1}`)}
            >Next</Button>
        </div>
      </div>
    </div>
  );
}
