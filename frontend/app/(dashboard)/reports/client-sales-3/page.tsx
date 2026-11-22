"use client";

/**
 * FlatReport wave-5 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha (rowsKey=clients) · oylik/dialog — · export+RBAC ha
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
  title: "Продажи по клиентам 3",
  apiPath: "client-sales-3",
  exportPermission: "reports.prodazhi_klientov_3.export",
  exportFilename: "prodazhi-po-klientam-3.xlsx",
  rowsKey: "clients",
  filterFields: [
    { kind: "dateRange" },
    { kind: "select", paramKey: "date_type", optionsFrom: "date_types", defaultValue: "order_date" },
    {
      kind: "select",
      paramKey: "client_activity",
      staticOptions: [
        { id: "all", label: "Все" },
        { id: "active", label: "Активные" },
        { id: "inactive", label: "Неактивные" }
      ],
      defaultValue: "all"
    },
    { kind: "search", placeholder: "Имя / телефон / ID" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
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
    { key: "client_id", header: "Ид", cellClassName: "text-muted-foreground" },
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "created_at", header: "Создан" },
    { key: "category", header: "Категория" },
    { key: "active", header: "Активен" },
    { key: "amount", header: "Сумма", align: "right", format: "money" },
    { key: "qty", header: "Кол-во", align: "right", format: "money" },
    { key: "volume", header: "Объём", align: "right", format: "money" },
    { key: "agents_list", header: "Агенты" },
    { key: "visit_days", header: "Дни визита" },
    { key: "last_order", header: "Посл. заказ" },
    { key: "days_since_last", header: "Дней", align: "right", format: "number" },
    { key: "city", header: "Город" },
    { key: "address", header: "Адрес" },
    { key: "phone", header: "Телефон" },
    { key: "expeditor_name", header: "Экспедитор" }
  ],
  totalsKeys: ["amount", "quantity", "volume"],
  totalsLabels: { amount: "Сумма", quantity: "Кол-во", volume: "Объём" },
  rowKey: "client_id",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["client_id", "client_name", "category", "agents_list", "city", "phone"],
    placeholder: "Фильтр в таблице…"
  },
  formatters: {
    created_at: (v) => fmtDt(v),
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
