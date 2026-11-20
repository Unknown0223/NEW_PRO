"use client";

/**
 * FlatReport wave-2 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "RFM",
  apiPath: "rfm",
  exportPermission: "reports.rfm.export",
  exportFilename: "rfm.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Клиент / агент" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
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
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "agent_name", header: "Агент" },
    { key: "client_category", header: "Категория" },
    { key: "last_order_at", header: "Посл. заказ" },
    { key: "last_order_days", header: "Дней", align: "right", format: "number" },
    { key: "order_count", header: "Заказов", align: "right", format: "number" },
    { key: "sales_sum", header: "Сумма", align: "right", format: "money" },
    { key: "avg_check", header: "Ср. чек", align: "right", format: "money" },
    { key: "r_score", header: "R", align: "right", format: "number" },
    { key: "f_score", header: "F", align: "right", format: "number" },
    { key: "m_score", header: "M", align: "right", format: "number" },
    { key: "rfm_label", header: "RFM" }
  ],
  totalsKeys: ["client_count", "order_count", "sales_sum"],
  totalsLabels: { client_count: "Клиентов", order_count: "Заказов", sales_sum: "Сумма" },
  rowKey: "client_id",
  countLabel: "Клиентов",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["client_name", "agent_name", "client_category", "rfm_label"],
    placeholder: "Фильтр в таблице…"
  },
  formatters: {
    last_order_at: (v) => {
      const s = String(v ?? "");
      if (!s) return "—";
      return s.slice(0, 16).replace("T", " ");
    }
  }
};

export default function ReportRfmPage() {
  return <FlatReportPage {...config} />;
}
