"use client";

/**
 * FlatReport wave-5 adapter (ADR-010 / ADR-012).
 * SalesDoc: /report/defect — parity 2026-11-24 probe.
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtDt(iso: unknown, withTime = false) {
  if (iso == null || iso === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  return withTime ? d.toLocaleString("ru-RU") : d.toLocaleDateString("ru-RU");
}

const config: FlatReportConfig = {
  title: "Отчет по возвратам (возврат с полки)",
  description: "Строки возврата с полки за период (SalesDoc /report/defect).",
  apiPath: "shelf-returns",
  exportPermission: "reports.vozvrat_s_polki.export",
  exportFilename: "vozvrat-s-polki.xlsx",
  tablePrefsId: "report.shelf-returns",
  dateTypeAsRadio: true,
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "select",
      paramKey: "date_type",
      optionsFrom: "date_types",
      defaultValue: "shipped_date"
    },
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
      placeholder: "Категории продуктов"
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
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "client_id", header: "Ид клиента", cellClassName: "text-muted-foreground" },
    { key: "client_code", header: "Код клиента" },
    { key: "client_legal_name", header: "Юр. наз. клиента" },
    { key: "client_category", header: "Кат-я клиента" },
    { key: "territory", header: "Территория" },
    { key: "qty", header: "Количество", align: "right", format: "money" },
    { key: "expeditor_name", header: "Экспедитор" },
    { key: "order_id", header: "Ид заказа", cellClassName: "text-muted-foreground" },
    { key: "order_number", header: "Номер заказа" },
    { key: "payment_method", header: "Способ оплаты" },
    { key: "price_type", header: "Тип цены" },
    { key: "warehouse_name", header: "Склад" },
    { key: "order_date", header: "Дата заявки" },
    { key: "shipped_at", header: "Дата отгрузки" },
    { key: "status_label", header: "Статус" },
    { key: "trade_direction", header: "Направление торговли" },
    { key: "volume", header: "Объем", align: "right", format: "money" },
    { key: "amount", header: "Сумма", align: "right", format: "money" },
    { key: "agent_name", header: "Агент" },
    { key: "agent_code", header: "Код агента" },
    { key: "supervisor_name", header: "Супервайзер" },
    { key: "supervisor_code", header: "Код супервайзера" },
    { key: "product_id", header: "Ид товара", cellClassName: "text-muted-foreground" },
    { key: "product_sku", header: "Код товара" },
    { key: "product_name", header: "Товар" },
    { key: "product_group", header: "Группа товара" },
    { key: "product_category", header: "Кат-я товара" },
    { key: "pack_qty", header: "Кол-во в упаковке", align: "right", format: "number" },
    { key: "product_volume", header: "Объем товара", align: "right", format: "money" },
    { key: "return_reason", header: "Причина возврата" }
  ],
  totalsKeys: ["amount", "qty", "volume"],
  totalsLabels: { amount: "Сумма", qty: "Количество", volume: "Объём" },
  rowKey: "row_number",
  countLabel: "Всего",
  showTableFooter: true,
  footerLeadColSpan: 6,
  clientTableSearch: {
    rowKeys: [
      "client_name",
      "client_code",
      "client_id",
      "product_name",
      "product_sku",
      "order_number",
      "order_id",
      "agent_name",
      "expeditor_name",
      "territory",
      "warehouse_name",
      "return_reason"
    ],
    placeholder: "Поиск в таблице возвратов"
  },
  formatters: {
    order_date: (v) => fmtDt(v, true),
    shipped_at: (v) => fmtDt(v, true),
    client_code: (v) => String(v ?? "") || "—",
    client_legal_name: (v) => String(v ?? "") || "—",
    client_category: (v) => String(v ?? "") || "—",
    territory: (v) => String(v ?? "") || "—",
    expeditor_name: (v) => String(v ?? "") || "—",
    payment_method: (v) => String(v ?? "") || "—",
    price_type: (v) => String(v ?? "") || "—",
    warehouse_name: (v) => String(v ?? "") || "—",
    trade_direction: (v) => String(v ?? "") || "—",
    agent_name: (v) => String(v ?? "") || "—",
    agent_code: (v) => String(v ?? "") || "—",
    supervisor_name: (v) => String(v ?? "") || "—",
    supervisor_code: (v) => String(v ?? "") || "—",
    product_group: (v) => String(v ?? "") || "—",
    product_category: (v) => String(v ?? "") || "—",
    return_reason: (v) => String(v ?? "") || "—"
  }
};

export default function ReportShelfReturnsPage() {
  return <FlatReportPage {...config} />;
}
