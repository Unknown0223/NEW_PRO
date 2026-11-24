"use client";

/**
 * FlatReport wave-5 adapter (ADR-010 / ADR-012).
 * SalesDoc: /report/customer/clientList — parity 2026-11-24 probe.
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
  title: "Продажи по клиентам 3",
  description: "Продажи и активность клиентов за период (SalesDoc clientList).",
  apiPath: "client-sales-3",
  exportPermission: "reports.prodazhi_klientov_3.export",
  exportFilename: "prodazhi-po-klientam-3.xlsx",
  rowsKey: "clients",
  tablePrefsId: "report.client-sales-3",
  dateTypeAsRadio: true,
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "select",
      paramKey: "date_type",
      optionsFrom: "date_types",
      defaultValue: "shipped_date"
    },
    {
      kind: "select",
      paramKey: "client_activity",
      staticOptions: [
        { id: "all", label: "Все клиенты" },
        { id: "active", label: "Активные клиенты" },
        { id: "inactive", label: "Неактивные клиенты" }
      ],
      defaultValue: "all"
    },
    {
      kind: "select",
      paramKey: "inventory_mode",
      optionsFrom: "inventory_modes",
      defaultValue: "all"
    },
    {
      kind: "select",
      paramKey: "last_days",
      optionsFrom: "last_days_options",
      defaultValue: "15"
    },
    {
      kind: "multiSelect",
      paramKey: "statuses",
      optionsFrom: "statuses",
      placeholder: "Статус",
      defaultValue: ["delivering", "delivered"]
    },
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
      placeholder: "Категория продукта"
    },
    {
      kind: "multiSelect",
      paramKey: "product_ids",
      optionsFrom: "products",
      placeholder: "Продукт"
    },
    {
      kind: "multiSelect",
      paramKey: "product_group_ids",
      optionsFrom: "groups",
      placeholder: "Группа"
    },
    {
      kind: "multiSelect",
      paramKey: "brand_ids",
      optionsFrom: "brands",
      placeholder: "Производитель"
    },
    {
      kind: "multiSelect",
      paramKey: "day_visit_iso",
      optionsFrom: "day_visit_options",
      placeholder: "День визита"
    },
    {
      kind: "multiSelect",
      paramKey: "client_categories",
      optionsFrom: "client_categories",
      placeholder: "Категория клиента"
    },
    {
      kind: "multiSelect",
      paramKey: "tag_ids",
      optionsFrom: "tags",
      placeholder: "Теги клиента"
    },
    {
      kind: "multiSelect",
      paramKey: "payment_methods",
      optionsFrom: "payment_methods",
      placeholder: "Тип оплаты"
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
    { key: "client_id", header: "Ид клиента", cellClassName: "text-muted-foreground" },
    { key: "client_name", header: "Название", cellClassName: "font-medium" },
    { key: "created_at", header: "Дата добавления" },
    { key: "category", header: "Категория" },
    { key: "active", header: "Активный" },
    { key: "amount", header: "Сумма", align: "right", format: "money" },
    { key: "qty", header: "Кол-во", align: "right", format: "money" },
    { key: "volume", header: "Объем", align: "right", format: "money" },
    { key: "agents_list", header: "Агент" },
    { key: "visit_days", header: "Дни посещения" },
    { key: "last_order", header: "Последний закуп" },
    { key: "days_since_last", header: "Кол-во дней с послед. закупа", align: "right", format: "number" },
    { key: "city", header: "Территория" },
    { key: "address", header: "Адрес" },
    { key: "phone", header: "Телефон" },
    { key: "expeditor_name", header: "Экспедитор" }
  ],
  totalsKeys: ["amount", "qty", "volume"],
  totalsLabels: { amount: "Сумма", qty: "Кол-во", volume: "Объём" },
  rowKey: "client_id",
  countLabel: "Всего",
  showTableFooter: true,
  footerLeadColSpan: 5,
  clientTableSearch: {
    rowKeys: [
      "client_id",
      "client_name",
      "category",
      "agents_list",
      "city",
      "address",
      "phone",
      "expeditor_name",
      "visit_days"
    ],
    placeholder: "Поиск в таблице клиентов"
  },
  rowClassName: (row, applied) => {
    const threshold = Number(applied.last_days);
    const days = Number(row.days_since_last);
    if (!Number.isFinite(threshold) || threshold <= 0) return undefined;
    if (!Number.isFinite(days)) return "bg-amber-50/80";
    return days >= threshold ? "bg-amber-50/80" : undefined;
  },
  formatters: {
    created_at: (v) => fmtDt(v, true),
    last_order: (v) => fmtDt(v),
    active: (v) => (v === true || v === "true" ? "Да" : "Нет"),
    category: (v) => String(v ?? "") || "—",
    agents_list: (v) => String(v ?? "") || "—",
    city: (v) => String(v ?? "") || "—",
    address: (v) => String(v ?? "") || "—",
    phone: (v) => String(v ?? "") || "—",
    expeditor_name: (v) => String(v ?? "") || "—",
    visit_days: (v) => String(v ?? "") || "—"
  }
};

export default function ReportClientSales3Page() {
  return <FlatReportPage {...config} />;
}
