"use client";

import { cn } from "@/lib/utils";

export function MonitoringExecutionBar({ completion }: { completion: number | null | undefined }) {
  const has = completion != null && Number.isFinite(completion);
  const p = has ? Math.min(100, Math.max(0, completion!)) : 0;
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-[100px] overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            p >= 100 ? "bg-emerald-500" : p >= 80 ? "bg-amber-500" : "bg-slate-300"
          )}
          style={{ width: `${p}%` }}
        />
      </div>
      <span
        className={cn(
          "w-9 text-right text-[12px] tabular-nums",
          p >= 100 ? "font-medium text-emerald-600" : "text-slate-600"
        )}
      >
        {has ? `${p.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}
