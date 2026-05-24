"use client";

import { salesExportButtonClass, SalesSectionHeader } from "@/components/dashboard/sales/sales-section-header";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const chartLoading = () => (
  <div className="h-[280px] animate-pulse rounded-lg bg-slate-100" aria-hidden />
);

const ReportsTrendCharts = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => ({ default: m.ReportsTrendCharts })),
  { ssr: false, loading: chartLoading }
);

export function SalesDynamicsSection({
  data,
  onExport
}: {
  data: SalesDashboardSnapshot;
  onExport: () => void;
}) {
  const trendRows = useMemo(
    () =>
      data.sales_dynamics.map((r) => ({
        dateShort: r.period.length >= 10 ? r.period.slice(5, 10) : r.period,
        orders: r.orders_count,
        revenue: Number(r.sales_sum) || 0
      })),
    [data.sales_dynamics]
  );

  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70">
      <SalesSectionHeader
        title="Динамика продаж"
        exportAction={
          <button type="button" className={salesExportButtonClass} onClick={onExport}>
            Excel
          </button>
        }
      />
      <div className="min-h-0 flex-1 p-4 pt-0">
        <ReportsTrendCharts rows={trendRows} />
      </div>
    </section>
  );
}
