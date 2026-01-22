"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";

export function ActivityTable({ logs, total, pages, currentPage }: any) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "activity";

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.eventType}</TableCell>
                <TableCell>{log.user?.email || "System"}</TableCell>
                 <TableCell className="max-w-md truncate" title={JSON.stringify(log.eventData)}>
                    {/* Render event data intelligently */}
                    {log.eventData ? JSON.stringify(log.eventData) : "-"}
                </TableCell>
                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

       <div className="flex items-center justify-between py-4">
         <div className="text-sm text-muted-foreground">
            Page {currentPage} of {pages}
         </div>
        <div className="flex justify-end gap-2">
            <Button 
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => router.push(`/admin?tab=${tab}&page=${currentPage-1}`)}
            >Previous</Button>
            <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= pages}
                onClick={() => router.push(`/admin?tab=${tab}&page=${currentPage+1}`)}
            >Next</Button>
        </div>
      </div>
    </div>
  );
}
