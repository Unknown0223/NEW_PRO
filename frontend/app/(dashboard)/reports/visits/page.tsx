"use client";

import { useState } from "react";
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";
import { VisitsMetricLink } from "@/components/reports/visits/visits-metric-link";
import {
  VisitsDetailModal,
  type VisitsDetailOpen,
  type VisitsDetailType
} from "@/components/reports/visits/visits-detail-modal";

const METRIC_TYPE: Record<string, VisitsDetailType> = {
  okb: "okb",
  akb: "only_order",
  refusals: "rejected",
  photo_reports: "only_photo",
  not_visited: "not_visited",
  visited: "visited"
};

const baseConfig: Omit<FlatReportConfig, "formatters"> = {
  title: "По визитам",
  apiPath: "visits",
  exportPermission: "reports.po_vizitam.export",
  exportFilename: "po-vizitam.xlsx",
  tablePrefsId: "report.visits.v1",
  filterGridCols: 9,
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "multiSelect",
      paramKey: "supervisor_ids",
      optionsFrom: "supervisors",
      placeholder: "Супервайзер"
    },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "visit_kinds",
      optionsFrom: "visit_kinds",
      placeholder: "Тип визита"
    },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус заказа" },
    {
      kind: "multiSelect",
      paramKey: "client_categories",
      optionsFrom: "client_categories",
      placeholder: "Категория клиента"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_1_list",
      optionsFrom: "territory_1",
      placeholder: "Зона"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_2_list",
      optionsFrom: "territory_2",
      placeholder: "Область"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_3_list",
      optionsFrom: "territory_3",
      placeholder: "Город"
    }
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "agent_name", header: "Название", cellClassName: "font-medium" },
    { key: "okb", header: "ОКБ", align: "right", format: "number" },
    { key: "akb", header: "АКБ", align: "right", format: "number" },
    { key: "orders_count", header: "Кол-во заказ.", align: "right", format: "number" },
    { key: "sales_sum", header: "Сумма", align: "right", format: "money" },
    { key: "refusals", header: "Отказы", align: "right", format: "number" },
    { key: "photo_reports", header: "Фотоотчёты", align: "right", format: "number" },
    { key: "visited", header: "Посещённые", align: "right", format: "number" },
    { key: "not_visited", header: "Непосещенные", align: "right", format: "number" },
    { key: "planned", header: "План", align: "right", format: "number" },
    { key: "visit_pct", header: "% посещ.", align: "right", format: "number" }
  ],
  totalsKeys: ["okb", "akb", "orders_count", "sales_sum", "visited", "planned"],
  totalsLabels: {
    okb: "ОКБ",
    akb: "АКБ",
    orders_count: "Заказов",
    sales_sum: "Сумма",
    visited: "Посещ.",
    planned: "План"
  },
  rowKey: "agent_id",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: { rowKeys: ["agent_name"], placeholder: "Фильтр в таблице…" }
};

export default function ReportVisitsPage() {
  const [detail, setDetail] = useState<VisitsDetailOpen | null>(null);

  const config: FlatReportConfig = {
    ...baseConfig,
    formatters: (applied) => {
      const make = (colKey: string) => {
        const render = (value: unknown, row: Record<string, unknown>) => {
          const type = METRIC_TYPE[colKey];
          if (!type) return String(value ?? "");
          const agentId = Number(row.agent_id);
          return (
            <VisitsMetricLink
              value={value}
              onOpen={() =>
                setDetail({
                  type,
                  agentId,
                  agentName: String(row.agent_name ?? ""),
                  applied
                })
              }
            />
          );
        };
        render.displayName = `VisitsMetric_${colKey}`;
        return render;
      };
      return {
        okb: make("okb"),
        akb: make("akb"),
        refusals: make("refusals"),
        photo_reports: make("photo_reports"),
        not_visited: make("not_visited"),
        visited: make("visited")
      };
    }
  };

  return (
    <>
      <FlatReportPage {...config} />
      <VisitsDetailModal open={detail} onOpenChange={setDetail} />
    </>
  );
}
