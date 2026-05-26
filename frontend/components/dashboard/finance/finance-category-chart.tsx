"use client";

import { FinanceSectionHeader } from "@/components/dashboard/finance/finance-section-header";
import { fmtFinanceCompact, fmtFinancePercent } from "@/components/dashboard/finance/format";
import type { FinanceDashboardSnapshot } from "@/components/dashboard/finance/types";
import { useMemo } from "react";

const COLORS = [
  "#15b8d8",
  "#0ea5e9",
  "#22c55e",
  "#a3e635",
  "#f97316",
  "#ef4444",
  "#f472b6",
  "#8b5cf6",
  "#14b8a6",
  "#64748b",
  "#84cc16",
  "#db2777",
  "#2563eb",
  "#92400e"
] as const;

function buildConicGradient(segments: { value: number; color: string }[]) {
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return "conic-gradient(#e2e8f0 0 100%)";
  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    const end = cursor + (segment.value / total) * 100;
    cursor = end;
    return `${segment.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

export function FinanceCategoryChart({ data }: { data: FinanceDashboardSnapshot }) {
  const chartRows = useMemo(
    () =>
      [...data.category_analytics]
        .filter((r) => Number(r.sales_sum) > 0)
        .sort((a, b) => Number(b.sales_sum) - Number(a.sales_sum)),
    [data.category_analytics]
  );
  const total = chartRows.reduce((s, r) => s + Number(r.sales_sum), 0);
  const gradient = buildConicGradient(
    chartRows.map((row, i) => ({
      value: Number(row.sales_sum),
      color: COLORS[i % COLORS.length]!
    }))
  );

  return (
    <section className="finance-motion-slide h-full rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <FinanceSectionHeader
        title="По категориям"
        subtitle="Топ категорий с прокручиваемой легендой"
      />
      <div className="grid min-h-[320px] grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(240px,320px),minmax(0,1fr)]">
        <div
          className="mx-auto flex h-64 w-64 items-center justify-center rounded-full p-8 shadow-inner"
          style={{ background: gradient }}
        >
          <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-slate-100">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Total</span>
            <strong className="mt-1 text-2xl font-black text-slate-950">{fmtFinanceCompact(total)}</strong>
            <span className="text-sm font-medium text-slate-500">UZS</span>
          </div>
        </div>
        <div className="max-h-[320px] min-w-0 space-y-2 overflow-y-auto pr-2">
          {chartRows.map((item, index) => (
            <div key={item.category} className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
              <div className="mb-2 flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{item.category}</p>
                <span className="text-sm font-black text-slate-700">{fmtFinancePercent(item.sales_share_pct)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="finance-motion-bar h-full rounded-full bg-teal-500"
                  style={{ width: `${Math.min(100, item.sales_share_pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
