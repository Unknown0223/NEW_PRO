"use client";

import { salesExportButtonClass, SalesSectionHeader } from "@/components/dashboard/sales/sales-section-header";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import dynamic from "next/dynamic";
import { useMemo } from "react";

const pieLoading = () => (
  <div className="h-[240px] animate-pulse rounded-lg bg-muted" aria-hidden />
);

const ReportsStatusPie = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => ({ default: m.ReportsStatusPie })),
  { ssr: false, loading: pieLoading }
);

export function SalesProductCharts({
  data,
  onExportCategories,
  onExportGroups
}: {
  data: SalesDashboardSnapshot;
  onExportCategories: () => void;
  onExportGroups: () => void;
}) {
  const categoryPie = useMemo(
    () =>
      data.product_category_analytics.map((r, i) => ({
        status: `cat_${i}`,
        name: r.category,
        value: Number(r.sales_sum) || 0
      })),
    [data.product_category_analytics]
  );
  const groupPie = useMemo(
    () =>
      data.product_group_analytics.map((r, i) => ({
        status: `grp_${i}`,
        name: r.product_group,
        value: Number(r.sales_sum) || 0
      })),
    [data.product_group_analytics]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl bg-card shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="По категориям продуктов"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExportCategories}>
              Excel
            </button>
          }
        />
        <div className="p-4 pt-0">
          <ReportsStatusPie slices={categoryPie} />
        </div>
      </section>
      <section className="rounded-2xl bg-card shadow-sm ring-1 ring-slate-200/70">
        <SalesSectionHeader
          title="По группам товаров"
          exportAction={
            <button type="button" className={salesExportButtonClass} onClick={onExportGroups}>
              Excel
            </button>
          }
        />
        <div className="p-4 pt-0">
          <ReportsStatusPie slices={groupPie} />
        </div>
      </section>
    </div>
  );
}
