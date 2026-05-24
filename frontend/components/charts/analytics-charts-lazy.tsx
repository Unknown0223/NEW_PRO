"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const chartFallback = <Skeleton className="h-full min-h-[200px] w-full rounded-lg" />;

export const SalesShareDonut = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => m.SalesShareDonut),
  { loading: () => chartFallback, ssr: false }
);

export const MonitoringDailyRevenueLine = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => m.MonitoringDailyRevenueLine),
  { loading: () => chartFallback, ssr: false }
);

export const MonitoringYearComparisonBars = dynamic(
  () => import("@/components/charts/analytics-charts").then((m) => m.MonitoringYearComparisonBars),
  { loading: () => chartFallback, ssr: false }
);

export const MonitoringClientDayColumnTotalsChart = dynamic(
  () =>
    import("@/components/charts/analytics-charts").then((m) => m.MonitoringClientDayColumnTotalsChart),
  { loading: () => chartFallback, ssr: false }
);

export type { ShareDonutSlice } from "@/components/charts/analytics-charts";
