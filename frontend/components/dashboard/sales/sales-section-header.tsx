"use client";

import { cn } from "@/lib/utils";

export function SalesSectionHeader({
  title,
  subtitle,
  exportAction
}: {
  title: string;
  subtitle?: string;
  exportAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {exportAction ? <div className={cn("shrink-0")}>{exportAction}</div> : null}
    </div>
  );
}

export const salesExportButtonClass =
  "inline-flex h-8 items-center justify-center rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-slate-700 hover:bg-muted disabled:opacity-50";
