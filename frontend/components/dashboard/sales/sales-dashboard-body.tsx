"use client";

import {
  SalesOrdersRefusalsChart,
  SalesPaymentRail,
  SalesProductAnalytics,
  SalesRefusalReasonsBlock,
  SalesTrendAreaChart
} from "@/components/dashboard/sales/sales-charts-sections";
import { SalesControlSection } from "@/components/dashboard/sales/sales-control-section";
import { SalesDataTable } from "@/components/dashboard/sales/sales-data-table";
import { SalesMetricsRow } from "@/components/dashboard/sales/sales-metrics-row";
import {
  useSalesAgentColumns,
  useSalesCategoryColumns,
  useSalesCoverageColumns,
  useSalesTerritoryColumns
} from "@/components/dashboard/sales/sales-table-columns";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import type { createSalesExportHandlers } from "@/components/dashboard/sales/sales-export";

export function SalesDashboardBody({
  data,
  resolvePayment,
  resolveTerritory,
  exporters,
  analyticsRef,
  breakdownRef
}: {
  data: SalesDashboardSnapshot;
  resolvePayment: (ref: string) => string;
  resolveTerritory: (ref: string) => string;
  exporters: ReturnType<typeof createSalesExportHandlers> | null;
  analyticsRef: React.Ref<HTMLDivElement>;
  breakdownRef: React.Ref<HTMLDivElement>;
}) {
  const categoryColumns = useSalesCategoryColumns(data.category_performance_table);
  const coverageColumns = useSalesCoverageColumns(data.category_performance_table);
  const territoryColumns = useSalesTerritoryColumns(resolveTerritory);
  const agentColumns = useSalesAgentColumns();

  return (
    <div className="space-y-4">
      <SalesMetricsRow data={data} />
      <SalesControlSection data={data} />

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_480px]">
        <div ref={analyticsRef} className="space-y-4">
          <SalesProductAnalytics data={data} />
          <SalesDataTable
            title="По категориям"
            data={data.category_performance_table}
            columns={categoryColumns}
            rowKey={(r) => r.category}
            initialPageSize={10}
            className="sales-motion-delay-200"
            onExportXlsx={() => exporters && void exporters.categoryPerformance()}
          />
          <SalesOrdersRefusalsChart data={data} />
          <SalesRefusalReasonsBlock data={data} />
          <SalesTrendAreaChart data={data} />
        </div>

        <div ref={breakdownRef} className="space-y-4">
          <SalesPaymentRail data={data} resolvePayment={resolvePayment} />
          <SalesDataTable
            title="ОКБ / АКБ"
            data={data.category_performance_table}
            columns={coverageColumns}
            rowKey={(r) => r.category}
            initialPageSize={5}
            compact
            className="sales-motion-delay-150"
            onExportXlsx={() => exporters && void exporters.categoryPerformance()}
          />
          <SalesDataTable
            title="По территориям"
            data={data.territory_analytics}
            columns={territoryColumns}
            rowKey={(r) => r.territory}
            initialPageSize={10}
            compact
            className="sales-motion-delay-200"
            onExportXlsx={() => exporters && void exporters.territory()}
          />
          <SalesDataTable
            title="По агентам"
            data={data.agent_analytics}
            columns={agentColumns}
            rowKey={(r) => String(r.agent_id)}
            initialPageSize={10}
            compact
            className="sales-motion-delay-250"
            onExportXlsx={() => exporters && void exporters.agents()}
          />
        </div>
      </div>
    </div>
  );
}
