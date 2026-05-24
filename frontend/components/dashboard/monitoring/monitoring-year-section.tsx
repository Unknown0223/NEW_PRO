"use client";

import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { formatMonthYearRu } from "@/components/dashboard/monitoring/utils";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

type YearRow = {
  direction: string;
  akb: number | null;
  qty: number | null;
  sum: number | null;
};

function monthBadgeLabel(month: number, year: number): string {
  const s = formatMonthYearRu(month, year);
  const parts = s.split(" ");
  if (parts.length >= 2) {
    const mon = parts[0]!.toLowerCase().slice(0, 3);
    return `${mon} ${parts[parts.length - 1]}`;
  }
  return s;
}

function GrowthMetric({ label, value }: { label: string; value: number | null }) {
  const has = value != null && Number.isFinite(value);
  const v = has ? value! : 0;
  const width = Math.min(100, Math.abs(v));
  const positive = v > 0;

  return (
    <div className="col-span-3 min-w-0">
      <div className="mb-0.5 text-[10px] text-slate-400">{label}</div>
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", positive && has ? "bg-emerald-500" : "bg-slate-300")}
            style={{ width: `${width}%`, marginLeft: v < 0 ? "auto" : "0" }}
          />
        </div>
        <span
          className={cn(
            "w-9 shrink-0 text-right text-[11px] tabular-nums",
            positive && has ? "text-emerald-600" : "text-slate-500"
          )}
        >
          {positive && has ? "▲" : ""}
          {has ? `${v.toFixed(0)}%` : "—"}
        </span>
      </div>
    </div>
  );
}

function buildYearRows(
  tradeDirections: MonitoringSnapshot["trade_directions"],
  yearComparison?: MonitoringSnapshot["year_comparison"]
): YearRow[] {
  const rows: YearRow[] = tradeDirections.map((d) => ({
    direction: d.direction,
    akb: null,
    qty: null,
    sum: null
  }));

  if (yearComparison) {
    rows.push({
      direction: "UMUMIY",
      akb: yearComparison.growth_pct.akb,
      qty: yearComparison.growth_pct.orders_count,
      sum: yearComparison.growth_pct.sales_sum
    });
  }

  if (rows.length === 0) {
    return [{ direction: "—", akb: null, qty: null, sum: null }];
  }

  return rows;
}

export function MonitoringYearSection({
  tradeDirections,
  yearComparison,
  month,
  year
}: {
  tradeDirections: MonitoringSnapshot["trade_directions"];
  yearComparison?: MonitoringSnapshot["year_comparison"];
  month: number;
  year: number;
}) {
  const rows = useMemo(() => buildYearRows(tradeDirections, yearComparison), [tradeDirections, yearComparison]);

  const prevMonth = yearComparison?.previous.month ?? month;
  const prevYear = yearComparison?.previous.year ?? year - 1;
  const curMonth = yearComparison?.current.month ?? month;
  const curYear = yearComparison?.current.year ?? year;

  return (
    <section className="sales-dashboard-panel sales-motion-slide-up flex h-full min-h-[320px] flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-semibold text-slate-900">Сравнение по годам:</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
            {monthBadgeLabel(prevMonth, prevYear)}
          </span>
          <span className="text-slate-400">↔</span>
          <span className="rounded-lg bg-teal-50 px-2.5 py-1 text-[12px] font-medium text-teal-700">
            {monthBadgeLabel(curMonth, curYear)}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-0 overflow-auto pr-1">
        {rows.map((y) => (
          <div
            key={y.direction}
            className="grid grid-cols-12 items-center gap-2 border-b border-slate-100 py-2 last:border-0"
          >
            <div className="col-span-3 truncate text-[12px] font-medium text-slate-700" title={y.direction}>
              {y.direction}
            </div>
            <GrowthMetric label="АКБ" value={y.akb} />
            <GrowthMetric label="Кол-во" value={y.qty} />
            <GrowthMetric label="Сумма" value={y.sum} />
          </div>
        ))}
      </div>
    </section>
  );
}
