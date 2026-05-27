"use client";

import type { RefusalsListResponse } from "@/lib/refusals-types";
import { TrendingDown } from "lucide-react";

export function RefusalsStatsBar({
  total,
  statsByReason
}: {
  total: number;
  statsByReason: RefusalsListResponse["stats_by_reason"];
}) {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-b border-border/60 bg-muted/30 px-4 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <TrendingDown className="size-3.5 text-teal-600" aria-hidden />
        <span className="font-medium text-muted-foreground">Всего отказов:</span>
        <span className="text-sm font-bold text-teal-700 tabular-nums dark:text-teal-400">{total}</span>
      </div>

      {statsByReason.length > 0 ? <div className="h-3.5 w-px bg-border" /> : null}

      {statsByReason.map((item) => (
        <div key={item.reason_ref} className="flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-full bg-teal-500/70" aria-hidden />
          <span className="font-medium text-muted-foreground">{item.reason_label}:</span>
          <span className="font-bold tabular-nums text-foreground">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
