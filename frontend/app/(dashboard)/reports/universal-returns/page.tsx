"use client";

/**
 * FlatReport wave-4 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtDt(iso: unknown) {
  if (iso == null || iso === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

const config: FlatReportConfig = {
  title: "Универсальный отчет по возвратам",
  apiPath: "universal-returns",
  exportPermission: "reports.universalnyy_vozvrat.export",
  exportFilename: "universalnyy-vozvrat.xlsx",
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
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "territory", header: "Территория" },
    { key: "product_name", header: "Товар" },
    { key: "qty", header: "Кол-во", align: "right", format: "number" },
    { key: "amount", header: "Сумма", align: "right", format: "money" },
    { key: "volume", header: "Объём", align: "right", format: "number" },
    { key: "order_number", header: "Заказ" },
    { key: "status_label", header: "Статус" },
    { key: "agent_name", header: "Агент" },
    { key: "expeditor_name", header: "Экспедитор" },
    { key: "warehouse_name", header: "Склад" },
    { key: "order_date", header: "Дата заявки" },
    { key: "shipped_at", header: "Отгрузка" },
    { key: "payment_method", header: "Оплата" },
    { key: "price_type", header: "Тип цены" },
    { key: "product_category", header: "Кат. товара" },
    { key: "return_reason", header: "Причина" }
  ],
  totalsKeys: ["amount", "qty", "volume"],
  totalsLabels: { amount: "Сумма", qty: "Кол-во", volume: "Объём" },
  rowKey: "row_number",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: [
      "client_name",
      "product_name",
      "order_number",
      "agent_name",
      "expeditor_name",
      "territory"
    ],
    placeholder: "Фильтр в таблице…"
  },
  formatters: {
    territory: (v) => String(v ?? "") || "—",
    agent_name: (v) => String(v ?? "") || "—",
    expeditor_name: (v) => String(v ?? "") || "—",
    warehouse_name: (v) => String(v ?? "") || "—",
    payment_method: (v) => String(v ?? "") || "—",
    price_type: (v) => String(v ?? "") || "—",
    product_category: (v) => String(v ?? "") || "—",
    return_reason: (v) => String(v ?? "") || "—",
    order_date: (v) => fmtDt(v),
    shipped_at: (v) => fmtDt(v)
  }
};

export default function ReportUniversalReturnsPage() {
  return <FlatReportPage {...config} />;
}
