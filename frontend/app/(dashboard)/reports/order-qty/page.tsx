"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * SalesDoc: /report/report/type — parity 2026-11-24 probe (AjaxType).
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Отчет по количеству заказов",
  description: "Количество заказов, возвратов с полки и обменов по торговым точкам (SalesDoc /report/report/type).",
  apiPath: "order-qty",
  exportPermission: "reports.kolichestvo_zakazov.export",
  exportFilename: "kolichestvo-zakazov.xlsx",
  tablePrefsId: "report.order-qty",
  filterGridCols: 9,
  filterFields: [
    { kind: "dateRange" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категории товаров"
    },
    {
      kind: "multiSelect",
      paramKey: "client_categories",
      optionsFrom: "client_categories",
      placeholder: "Категории клиентов"
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
  totalsLabels: {
    order_count: "Заказ",
    return_count: "Возврат с полки",
    exchange_count: "Обмен"
  },
  rowKey: "client_id",
  countLabel: "Всего клиентов",
  showTableFooter: true,
  footerLeadColSpan: 3,
  clientTableSearch: {
    rowKeys: ["client_name", "phone", "agent_name"],
    placeholder: "Поиск в таблице"
  },
  formatters: {
    phone: (v) => String(v ?? "") || "—",
    agent_name: (v) => String(v ?? "") || "—"
  }
};

export default function ReportOrderQtyPage() {
  return <FlatReportPage {...config} />;
}
