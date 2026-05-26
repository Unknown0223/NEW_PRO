"use client";

import { MonitoringDailyRevenueLine } from "@/components/charts/analytics-charts-lazy";
import { MonitoringChannelsBar } from "@/components/dashboard/monitoring/monitoring-channels-bar";
import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import { formatMonthYearRu, num } from "@/components/dashboard/monitoring/utils";
import { useMemo } from "react";

/** Shablon: «Дневная продажа» + «Продажи по каналам» — har doim ko‘rinadi. */
export function MonitoringDailyChannelsRow({
  data,
  month,
  year
}: {
  data: MonitoringSnapshot;
  month: number;
  year: number;
}) {
  const dailyRevenueRows = useMemo(
    () =>
      (data.daily_sales ?? []).map((r) => ({
        day: r.day,
        revenue: num(r.sales_sum)
      })),
    [data.daily_sales]
  );

  const hasDailySales = dailyRevenueRows.some((r) => r.revenue > 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">Дневная продажа</h2>
        <p className="mb-4 text-sm text-slate-500">{formatMonthYearRu(month, year)}</p>
        <div className="relative min-h-[256px]">
          {!hasDailySales ? (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
              Нет продаж за период
            </p>
          ) : (
            <MonitoringDailyRevenueLine rows={dailyRevenueRows} cumulative={false} />
          )}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Продажи по каналам</h2>
        <MonitoringChannelsBar channels={data.sales_channels ?? []} height={256} />
      </div>
    </div>
  );
}
