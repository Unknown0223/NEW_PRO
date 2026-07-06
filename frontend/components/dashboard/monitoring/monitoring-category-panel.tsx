"use client";

import { SalesShareDonut, type ShareDonutSlice } from "@/components/charts/analytics-charts-lazy";
import { CategoryDonutLegend } from "@/components/dashboard/monitoring/monitoring-channels-bar";

const EMPTY: ShareDonutSlice[] = [{ status: "empty", name: "Нет данных", value: 1, share_pct: 0 }];

export function MonitoringCategoryPanel({ slices }: { slices: ShareDonutSlice[] }) {
  const donutSlices = slices.length > 0 ? slices : EMPTY;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Факт продаж по категориям</h2>
      <div className="h-48">
        <SalesShareDonut slices={donutSlices} height={192} />
      </div>
      <CategoryDonutLegend slices={donutSlices} />
    </div>
  );
}
