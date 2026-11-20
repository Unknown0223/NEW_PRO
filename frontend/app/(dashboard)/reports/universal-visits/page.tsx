"use client";

/**
 * FlatReport wave-4 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Универсальный отчет по посещениям",
  apiPath: "universal-visits",
  exportPermission: "reports.universalnyy_vizity.export",
  exportFilename: "universalnyy-vizity.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Агент" },
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
      placeholder: "Территория 1"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_2_list",
      optionsFrom: "territory_2",
      placeholder: "Территория 2"
    },
    {
      kind: "multiSelect",
      paramKey: "territory_3_list",
      optionsFrom: "territory_3",
      placeholder: "Территория 3"
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

export default function ReportUniversalVisitsPage() {
  return <FlatReportPage {...config} />;
}
