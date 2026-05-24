"use client";

import { fmtCount, fmtMoney } from "@/components/dashboard/sales/format";
import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import { TrendingUp } from "lucide-react";

function MiniMetric({
  title,
  value,
  note,
  accent = false
}: {
  title: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
          : "rounded-2xl border border-slate-200 bg-white p-5"
      }
    >
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className={`mt-2 text-2xl font-black ${accent ? "text-emerald-600" : "text-slate-950"}`}>
        {value}
      </p>
      <p className="mt-1.5 text-xs text-slate-400">{note}</p>
    </div>
  );
}

export function SalesControlSection({ data }: { data: SalesDashboardSnapshot }) {
  const { akb, okb, coverage_pct } = data.akb_okb_block;
  const total = data.total_sales_summary.total_sales_sum;

  return (
    <SalesSectionPanel
      className="sales-motion-delay-100"
      title="Sales Control"
      subtitle="Savdo sifati, coverage va conversion tez o'qiladigan KPI formatida."
    >
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-2xl bg-gradient-to-br from-[#063f3b] via-[#08736d] to-[#0f9f9a] p-5 text-white shadow-xl shadow-teal-900/20 lg:col-span-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-100/75">
                Общая сумма
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">{fmtMoney(total)}</h1>
              <p className="mt-1.5 text-[11px] text-teal-50/70">
                {fmtCount(data.total_sales_summary.orders_count)} заказов · ОКБ {coverage_pct.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-white/12 p-2 ring-1 ring-white/18">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="sales-progress-stripes mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.min(100, coverage_pct)}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold text-teal-50/75">
            <span>Coverage</span>
            <span>{coverage_pct.toFixed(1)}%</span>
          </div>
        </div>
        <MiniMetric title="Заказы" value={fmtCount(data.total_sales_summary.orders_count)} note="orders in period" />
        <MiniMetric title="ОКБ (по плану)" value={fmtCount(okb)} note="planned customers" />
        <MiniMetric title="АКБ (заказы)" value={fmtCount(akb)} note="actual ordered customers" accent />
      </div>
    </SalesSectionPanel>
  );
}
