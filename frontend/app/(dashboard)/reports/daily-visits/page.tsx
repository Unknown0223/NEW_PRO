"use client";

/**
 * FlatReport wave-2 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha (year/month select) · chrome ha · oylik/dialog ha (select) · export+RBAC ha
 * dateRange yo‘q — FlatReport (ADR-012).
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const now = new Date();
const defaultYear = String(now.getUTCFullYear());
const defaultMonth = String(now.getUTCMonth() + 1);

const config: FlatReportConfig = {
  title: "По дневному посещению",
  apiPath: "daily-visits",
  exportPermission: "reports.po_dnevnomu_poseshcheniyu.export",
  exportFilename: "po-dnevnomu-poseshcheniyu.xlsx",
  tablePrefsId: "report.daily-visits.v1",
  filterGridCols: 9,
  filterFields: [
    {
      kind: "select",
      paramKey: "year",
      optionsFrom: "years",
      defaultValue: defaultYear,
      placeholder: "Год"
    },
    {
      kind: "select",
      paramKey: "month",
      optionsFrom: "months",
      defaultValue: defaultMonth,
      placeholder: "Месяц"
    },
    {
      kind: "multiSelect",
      paramKey: "visit_kinds",
      optionsFrom: "visit_kinds",
      placeholder: "Тип визита"
    },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" }
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "work_date", header: "Дата" },
    { key: "agent_name", header: "Агент", cellClassName: "font-medium" },
    { key: "visited", header: "Посещённые", align: "right", format: "number" },
    { key: "planned", header: "План", align: "right", format: "number" },
    { key: "not_visited", header: "Непосещенные", align: "right", format: "number" },
    { key: "orders_count", header: "Заказы", align: "right", format: "number" },
    { key: "photo_reports", header: "Фотоотчёты", align: "right", format: "number" },
    { key: "refusals", header: "Отказы", align: "right", format: "number" },
    { key: "visit_pct", header: "% посещ.", align: "right", format: "number" }
  ],
  totalsKeys: [
    "visited",
    "planned",
    "not_visited",
    "orders_count",
    "photo_reports",
    "refusals"
  ],
  totalsLabels: {
    visited: "Посещённые",
    planned: "План",
    not_visited: "Непосещенные",
    orders_count: "Заказы",
    photo_reports: "Фотоотчёты",
    refusals: "Отказы"
  },
  rowKey: "row_number",
  countLabel: "Строк",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["work_date", "agent_name"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportDailyVisitsPage() {
  return <FlatReportPage {...config} />;
}
