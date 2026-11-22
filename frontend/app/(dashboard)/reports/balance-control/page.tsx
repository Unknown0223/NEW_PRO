"use client";

/**
 * FlatReport wave-2 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 * balance_filter: select (options value/label → mapMultiOptions.value)
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Контроль балансов",
  apiPath: "balance-control",
  exportPermission: "reports.kontrol_balansov.export",
  exportFilename: "kontrol-balansov.xlsx",
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "select",
      paramKey: "balance_filter",
      optionsFrom: "balance_filters",
      defaultValue: "all"
    },
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
    { key: "territory", header: "Территория" },
    { key: "balance", header: "Баланс", align: "right", format: "money" },
    { key: "period_sales", header: "Продажи", align: "right", format: "money" },
    { key: "period_payments", header: "Оплаты", align: "right", format: "money" },
    { key: "debt_flag_label", header: "Тип" }
  ],
  totalsKeys: ["client_count", "balance_sum", "period_sales_sum", "period_payments_sum"],
  totalsLabels: {
    client_count: "Клиентов",
    balance_sum: "Баланс",
    period_sales_sum: "Продажи",
    period_payments_sum: "Оплаты"
  },
  rowKey: "client_id",
  countLabel: "Клиентов",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["client_name", "agent_name", "client_category", "territory", "debt_flag_label"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportBalanceControlPage() {
  return <FlatReportPage {...config} />;
}
