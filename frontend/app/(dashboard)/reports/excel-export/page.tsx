"use client";

/**
 * FlatReport wave-5 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome qisman (subtitle «SalesDoc Version 1» yo‘q) · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtDate(iso: unknown) {
  if (iso == null || iso === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU");
}

const config: FlatReportConfig = {
  title: "Excel экспорт",
  apiPath: "excel-export",
  exportPermission: "reports.excel_eksport.export",
  exportFilename: "excel-eksport.xlsx",
  exportLimit: 10000,
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "select",
      paramKey: "date_type",
      optionsFrom: "date_types",
      defaultValue: "shipped_date"
    },
    { kind: "search", placeholder: "Клиент / товар / № заказа" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "expeditor_ids",
      optionsFrom: "expeditors",
      placeholder: "Экспедитор"
    },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория товара"
    },
    {
      kind: "multiSelect",
      paramKey: "product_ids",
      optionsFrom: "products",
      placeholder: "Продукт"
    },
    {
      kind: "multiSelect",
      paramKey: "warehouse_ids",
      optionsFrom: "warehouses",
      placeholder: "Склад"
    },
    {
      kind: "multiSelect",
      paramKey: "payment_methods",
      optionsFrom: "payment_methods",
      placeholder: "Способ оплаты"
    },
    {
      kind: "multiSelect",
      paramKey: "price_types",
      optionsFrom: "price_types",
      placeholder: "Тип цены"
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
    { key: "order_number", header: "Заказ", cellClassName: "font-medium" },
    { key: "shipped_at", header: "Отгрузка" },
    { key: "client_name", header: "Клиент" },
    { key: "product_name", header: "Товар" },
    { key: "qty", header: "Кол-во", align: "right", format: "money" },
    { key: "status_label", header: "Статус" },
    { key: "agent_name", header: "Агент" },
    { key: "expeditor_name", header: "Экспедитор" },
    { key: "territory", header: "Территория" },
    { key: "price", header: "Цена", align: "right", format: "money" },
    { key: "amount", header: "Сумма", align: "right", format: "money" }
  ],
  totalsKeys: [],
  rowKey: "row_number",
  countLabel: "Строк",
  showTableFooter: false,
  formatters: {
    shipped_at: (v) => fmtDate(v),
    order_number: (v, row) => String(v ?? row.order_id ?? "—")
  }
};

export default function ReportExcelExportPage() {
  return <FlatReportPage {...config} />;
}
