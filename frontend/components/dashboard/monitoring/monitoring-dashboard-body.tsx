"use client";

import { MonitoringCategoryPanel } from "@/components/dashboard/monitoring/monitoring-category-panel";
import { MonitoringDailyChannelsRow } from "@/components/dashboard/monitoring/monitoring-daily-channels-row";
import {
  MonitoringOkbAkbCard,
  MonitoringSalesKpiCard
} from "@/components/dashboard/monitoring/monitoring-kpi-top-row";
import {
  MonitoringPerformanceTable,
  type MonitoringPerformanceRow
} from "@/components/dashboard/monitoring/monitoring-performance-table";
import { MonitoringPortfolioSection } from "@/components/dashboard/monitoring/monitoring-portfolio-section";
import { MonitoringSkuTable } from "@/components/dashboard/monitoring/monitoring-sku-table";
import { MonitoringYearSection } from "@/components/dashboard/monitoring/monitoring-year-section";
import type { MonitoringSectionId } from "@/components/dashboard/monitoring/monitoring-section-config";
import type { MonitoringSnapshot } from "@/components/dashboard/monitoring/types";
import type { ShareDonutSlice } from "@/components/charts/analytics-charts-lazy";
import { memo, useMemo } from "react";

export const MonitoringDashboardBody = memo(function MonitoringDashboardBody({
  data,
  appliedMonth,
  appliedYear,
  categorySlices,
  branchTotal,
  branchPage,
  branchPageSize,
  onBranchPageChange,
  onBranchPageSizeChange,
  skuTotal,
  skuPage,
  skuPageSize,
  onSkuPageChange,
  onSkuPageSizeChange,
  skuRows,
  skuVisibleColumnOrder,
  onOpenSkuColumns,
  visibleSectionIds
}: {
  data: MonitoringSnapshot;
  appliedMonth: number;
  appliedYear: number;
  categorySlices: ShareDonutSlice[];
  branchTotal: number;
  branchPage: number;
  branchPageSize: number;
  onBranchPageChange: (p: number) => void;
  onBranchPageSizeChange: (s: number) => void;
  skuTotal: number;
  skuPage: number;
  skuPageSize: number;
  onSkuPageChange: (p: number) => void;
  onSkuPageSizeChange: (s: number) => void;
  skuRows: MonitoringSnapshot["sku_matrix"];
  skuVisibleColumnOrder: string[];
  onOpenSkuColumns: () => void;
  visibleSectionIds: Set<MonitoringSectionId>;
}) {
  const show = (id: MonitoringSectionId) => visibleSectionIds.has(id);

  const branchRows: MonitoringPerformanceRow[] = useMemo(
    () =>
      data.branch_performance.map((r) => ({
        key: r.branch,
        name: r.branch,
        akb: r.akb,
        plan: r.plan_sales,
        fact: r.fact_sales,
        execution: r.execution_pct
      })),
    [data.branch_performance]
  );

  const directionRows: MonitoringPerformanceRow[] = useMemo(
    () =>
      data.trade_directions.map((r) => ({
        key: r.direction,
        name: r.direction,
        akb: null,
        plan: "—",
        fact: r.sales_sum,
        execution: r.share_pct,
        executionIsShare: true
      })),
    [data.trade_directions]
  );

  const topVisible =
    show("bySales") || show("okbAkb") || show("factByCategories");

  return (
    <div className="flex flex-col gap-6">
      {topVisible ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {show("bySales") ? <MonitoringSalesKpiCard data={data} /> : null}
          {show("okbAkb") ? <MonitoringOkbAkbCard data={data} /> : null}
          {show("factByCategories") ? <MonitoringCategoryPanel slices={categorySlices} /> : null}
        </div>
      ) : null}

      {show("byBranches") ? (
        <MonitoringPerformanceTable
          title="По филиалам"
          rows={branchRows}
          total={branchTotal}
          page={branchPage}
          pageSize={branchPageSize}
          onPageChange={onBranchPageChange}
          onPageSizeChange={onBranchPageSizeChange}
          serverPaging
        />
      ) : null}

      {show("byTradeDirections") ? (
        <MonitoringPerformanceTable
          title="По направлениям торговли"
          rows={directionRows}
          total={directionRows.length}
          page={0}
          pageSize={20}
          onPageChange={() => {}}
          onPageSizeChange={() => {}}
          serverPaging={false}
        />
      ) : null}

      <MonitoringDailyChannelsRow data={data} month={appliedMonth} year={appliedYear} />

      {show("akbByPortfolios") ? (
        <MonitoringPortfolioSection branches={data.branch_performance} />
      ) : null}

      {show("bySku") ? (
        <MonitoringSkuTable
          rows={skuRows}
          total={skuTotal}
          page={skuPage}
          pageSize={skuPageSize}
          onPageChange={onSkuPageChange}
          onPageSizeChange={onSkuPageSizeChange}
          visibleColumnOrder={skuVisibleColumnOrder}
          onOpenColumns={onOpenSkuColumns}
        />
      ) : null}

      {show("yearComparison") ? (
        <MonitoringYearSection
          tradeDirections={data.trade_directions ?? []}
          yearComparison={data.year_comparison}
          month={appliedMonth}
          year={appliedYear}
        />
      ) : null}
    </div>
  );
});
