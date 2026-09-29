"use client";

import {
  SalesOrdersRefusalsChart,
  SalesPaymentRail,
  SalesProductAnalytics,
  SalesRefusalReasonsBlock,
  SalesTrendAreaChart
} from "@/components/dashboard/sales/sales-charts-sections";
import { SalesDataTable } from "@/components/dashboard/sales/sales-data-table";
import { SalesMetricsRow } from "@/components/dashboard/sales/sales-metrics-row";
import {
  useSalesAgentColumns,
  useSalesCategoryColumns,
  useSalesTerritoryColumns
} from "@/components/dashboard/sales/sales-table-columns";
import type { SalesDashboardSnapshot } from "@/components/dashboard/sales/types";
import type { createSalesExportHandlers } from "@/components/dashboard/sales/sales-export";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  const territoryColumns = useSalesTerritoryColumns(resolveTerritory);
  const agentColumns = useSalesAgentColumns();
  const [breakdownView, setBreakdownView] = useState<"territory" | "category">("territory");
  const viewToggle = (
    <div className="inline-flex rounded-xl border border-border bg-muted p-1" role="tablist">
      {(
        [
          { id: "territory", label: "Территории" },
          { id: "category", label: "Категории товаров" }
        ] as const
      ).map((v) => (
        <button
          key={v.id}
          type="button"
          role="tab"
          aria-selected={breakdownView === v.id}
          onClick={() => setBreakdownView(v.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            breakdownView === v.id
              ? "bg-card text-teal-700 shadow-sm"
              : "text-slate-500 hover:text-slate-800"
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <SalesMetricsRow data={data} resolvePayment={resolvePayment} />

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_480px]">
        <div ref={analyticsRef} className="space-y-4">
          <SalesProductAnalytics data={data} />
          <SalesOrdersRefusalsChart data={data} />
          <SalesRefusalReasonsBlock data={data} />
          <SalesTrendAreaChart data={data} />
        </div>

        <div ref={breakdownRef} className="space-y-4">
          <SalesPaymentRail data={data} resolvePayment={resolvePayment} />
          {breakdownView === "territory" ? (
            <SalesDataTable
              key="territory"
              title="По территориям"
              action={viewToggle}
              data={data.territory_analytics}
              columns={territoryColumns}
              rowKey={(r) => r.territory}
              initialPageSize={10}
              compact
              className="sales-motion-delay-200"
              onExportXlsx={() => exporters && void exporters.territory()}
            />
          ) : (
            <SalesDataTable
              key="category"
              title="По категориям товаров"
              action={viewToggle}
              data={data.category_performance_table}
              columns={categoryColumns}
              rowKey={(r) => r.category}
              initialPageSize={10}
              compact
              className="sales-motion-delay-200"
              onExportXlsx={() => exporters && void exporters.categoryPerformance()}
            />
          )}
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
