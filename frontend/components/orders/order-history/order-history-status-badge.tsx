"use client";

import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  CONFIRMED: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  SHIPPED: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  DELIVERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
};

export function OrderHistoryStatusBadge({
  status,
  statusKey
}: {
  status: string;
  statusKey?: string;
}) {
  if (!status) return null;

  const colorClass = statusKey
    ? statusColors[statusKey] || "bg-muted text-muted-foreground"
    : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {status}
    </span>
  );
}
