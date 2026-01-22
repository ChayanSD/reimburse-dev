"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AdminTabs() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "overview";

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "users", label: "Users" },
    { value: "revenue", label: "Revenue" },
    { value: "activity", label: "Activity" },
  ];

  return (
    <div className="flex space-x-2 mb-6 border-b pb-4">
      {tabs.map((t) => (
        <Link key={t.value} href={`/admin?tab=${t.value}`}>
          <Button
            variant={tab === t.value ? "default" : "ghost"}
            className={cn("w-32", tab === t.value ? "" : "text-muted-foreground")}
          >
            {t.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}
