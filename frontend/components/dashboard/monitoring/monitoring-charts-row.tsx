"use client";

import {
  MonitoringDailyRevenueLine,
  SalesShareDonut,
  type ShareDonutSlice
} from "@/components/charts/analytics-charts-lazy";
import { buildMonthDailyPlaceholder } from "@/components/dashboard/monitoring/monitoring-chart-placeholders";
import {
  CategoryDonutLegend,
  MonitoringChannelsBar
} from "@/components/dashboard/monitoring/monitoring-channels-bar";
import { SalesSectionPanel } from "@/components/dashboard/sales/sales-section-panel";
import { formatMonthYearRu, num } from "@/components/dashboard/monitoring/utils";
import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

const EMPTY_DONUT_SLICE: ShareDonutSlice[] = [
  { status: "empty", name: "Нет данных", value: 1, share_pct: 0 }
];

export function MonitoringChartsRow({
  data,
  categorySlices,
  month,
  year
}: {
  data: MonitoringSnapshot;
  categorySlices: ShareDonutSlice[];
  month: number;
  year: number;
}) {
  const [cumulativeChart, setCumulativeChart] = useState(false);

  const donutSlices = categorySlices.length > 0 ? categorySlices : EMPTY_DONUT_SLICE;

  const dailyRevenueRows = useMemo(() => {
    const fromApi = (data.daily_sales ?? []).map((r) => ({
      day: r.day,
      revenue: num(r.sales_sum)
    }));
    if (fromApi.length > 0) return fromApi;
    return buildMonthDailyPlaceholder(year, month);
  }, [data.daily_sales, year, month]);

  const hasDailySales = (data.daily_sales ?? []).some((r) => num(r.sales_sum) > 0);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
      <SalesSectionPanel
        className="xl:col-span-3 sales-motion-delay-100"
        title="Факт продаж по категориям"
      >
        <div className="h-[200px]">
          <SalesShareDonut slices={donutSlices} height={200} />
        </div>
        <CategoryDonutLegend slices={donutSlices} />
      </SalesSectionPanel>

      <SalesSectionPanel
        className="xl:col-span-5 sales-motion-delay-150"
        title="Дневная продажа"
        subtitle={formatMonthYearRu(month, year)}
        action={
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant={!cumulativeChart ? "default" : "outline"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setCumulativeChart(false)}
            >
              По дням
            </Button>
            <Button
              type="button"
              variant={cumulativeChart ? "default" : "outline"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => setCumulativeChart(true)}
            >
              Накопит.
            </Button>
          </div>
        }
      >
        <div className="relative min-h-[260px]">
          {!hasDailySales ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <span className="rounded-md bg-white/80 px-2 py-1 text-[11px] text-slate-500">Нет продаж за период</span>
            </div>
          ) : null}
          <MonitoringDailyRevenueLine rows={dailyRevenueRows} cumulative={cumulativeChart} />
        </div>
      </SalesSectionPanel>

      <SalesSectionPanel className="xl:col-span-4 sales-motion-delay-200" title="Продажи по каналам">
        <MonitoringChannelsBar channels={data.sales_channels ?? []} height={260} />
      </SalesSectionPanel>
    </div>
  );
}
