"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Отчет по количеству заказов",
  apiPath: "order-qty",
  exportPermission: "reports.kolichestvo_zakazov.export",
  exportFilename: "kolichestvo-zakazov.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Клиент / телефон / агент" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория товара"
    },
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
    { key: "client_name", header: "Т.Т.", cellClassName: "font-medium" },
    { key: "phone", header: "Телефон клиента" },
    { key: "agent_name", header: "Т.П." },
    { key: "order_count", header: "Заказ", align: "right", format: "number" },
    { key: "return_count", header: "Возврат с полки", align: "right", format: "number" },
    { key: "exchange_count", header: "Обмен", align: "right", format: "number" }
  ],
  totalsKeys: ["order_count", "return_count", "exchange_count"],
  totalsLabels: { order_count: "Заказ", return_count: "Возврат", exchange_count: "Обмен" },
  rowKey: "client_id",
  countLabel: "Всего клиентов",
  footerLeadColSpan: 3,
  clientTableSearch: {
    rowKeys: ["client_name", "phone", "agent_name"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportOrderQtyPage() {
  return <FlatReportPage {...config} />;
}
