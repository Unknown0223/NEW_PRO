"use client";

import { buildClientDayMatrix } from "@/components/dashboard/monitoring/client-day-matrix";
import { toDonutSlices } from "@/components/dashboard/monitoring/donut-slices";
import { MonitoringChartsRow } from "@/components/dashboard/monitoring/monitoring-charts-row";
import { MonitoringClientMatrix } from "@/components/dashboard/monitoring/monitoring-client-matrix";
import { MonitoringKpiStrip } from "@/components/dashboard/monitoring/monitoring-kpi-strip";
import { MonitoringPerformanceTabs } from "@/components/dashboard/monitoring/monitoring-performance-tabs";
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
  supervisorTotal,
  skuTotal,
  branchPage,
  branchPageSize,
  onBranchPageChange,
  onBranchPageSizeChange,
  supervisorPage,
  supervisorPageSize,
  onSupervisorPageChange,
  onSupervisorPageSizeChange,
  skuPage,
  skuPageSize,
  onSkuPageChange,
  onSkuPageSizeChange,
  skuRows,
  skuVisibleColumnOrder,
  onOpenSkuColumns,
  clientMatrixRef,
  visibleSectionIds
}: {
  data: MonitoringSnapshot;
  appliedMonth: number;
  appliedYear: number;
  categorySlices: ShareDonutSlice[];
  branchTotal: number;
  supervisorTotal: number;
  skuTotal: number;
  branchPage: number;
  branchPageSize: number;
  onBranchPageChange: (p: number) => void;
  onBranchPageSizeChange: (s: number) => void;
  supervisorPage: number;
  supervisorPageSize: number;
  onSupervisorPageChange: (p: number) => void;
  onSupervisorPageSizeChange: (s: number) => void;
  skuPage: number;
  skuPageSize: number;
  onSkuPageChange: (p: number) => void;
  onSkuPageSizeChange: (s: number) => void;
  skuRows: MonitoringSnapshot["sku_matrix"];
  skuVisibleColumnOrder: string[];
  onOpenSkuColumns: () => void;
  clientMatrixRef?: React.Ref<HTMLDivElement>;
  visibleSectionIds: Set<MonitoringSectionId>;
}) {
  const clientMatrix = useMemo(
    () => buildClientDayMatrix(data.client_daily_sales ?? []),
    [data.client_daily_sales]
  );

  const show = (id: MonitoringSectionId) => visibleSectionIds.has(id);

  return (
    <div className="flex flex-col gap-4">
      {show("kpi_sales") ? (
        <MonitoringKpiStrip data={data} month={appliedMonth} year={appliedYear} />
      ) : null}
      {show("charts") ? (
        <MonitoringChartsRow data={data} categorySlices={categorySlices} month={appliedMonth} year={appliedYear} />
      ) : null}
      {show("performance") ? (
      <MonitoringPerformanceTabs
        data={data}
        branchTotal={branchTotal}
        supervisorTotal={supervisorTotal}
        branchPage={branchPage}
        branchPageSize={branchPageSize}
        onBranchPageChange={onBranchPageChange}
        onBranchPageSizeChange={onBranchPageSizeChange}
        supervisorPage={supervisorPage}
        supervisorPageSize={supervisorPageSize}
        onSupervisorPageChange={onSupervisorPageChange}
        onSupervisorPageSizeChange={onSupervisorPageSizeChange}
      />
      ) : null}
      {show("portfolio") || show("year_comparison") ? (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        {show("portfolio") ? (
        <div className={show("year_comparison") ? "xl:col-span-7" : "col-span-full"}>
          <MonitoringPortfolioSection branches={data.branch_performance} />
        </div>
        ) : null}
        {show("year_comparison") ? (
        <div className={show("portfolio") ? "xl:col-span-5" : "col-span-full"}>
          <MonitoringYearSection
            tradeDirections={data.trade_directions ?? []}
            yearComparison={data.year_comparison}
            month={appliedMonth}
            year={appliedYear}
          />
        </div>
        ) : null}
      </div>
      ) : null}
      {show("sku") ? (
      <div ref={clientMatrixRef}>
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
      </div>
      ) : null}
      {show("client_matrix") ? <MonitoringClientMatrix clientMatrix={clientMatrix} /> : null}
    </div>
  );
});
