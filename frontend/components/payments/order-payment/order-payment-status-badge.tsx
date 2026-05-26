"use client";

import { orderStatusLabelRu } from "@/components/orders/order-create/utils";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  new: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  picking: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  delivering: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  returned: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200"
};

export function OrderPaymentStatusBadge({ status }: { status: string }) {
  const key = status.trim().toLowerCase();
  const label = orderStatusLabelRu(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium",
        statusColors[key] ?? "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}
