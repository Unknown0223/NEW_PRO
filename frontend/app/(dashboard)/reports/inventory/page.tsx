"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "По инвентарю",
  apiPath: "inventory",
  exportPermission: "reports.po_inventaryu.export",
  exportFilename: "po-inventaryu.xlsx",
  tablePrefsId: "report.inventory.v2",
  dateTypeAsRadio: true,
  /** 11 filtr → xl 6 ustun = 2 to‘liq qator (qidiruv jadvalda). */
  filterGridCols: 6,
  filterFields: [
    { kind: "dateRange" },
    { kind: "select", paramKey: "date_type", optionsFrom: "date_types", defaultValue: "order_date" },
    { kind: "select", paramKey: "client_active", optionsFrom: "client_active", defaultValue: "all" },
    {
      kind: "multiSelect",
      paramKey: "inventory_types",
      optionsFrom: "inventory_types",
      placeholder: "Тип инвентаря"
    },
    {
      kind: "multiSelect",
      paramKey: "payment_methods",
      optionsFrom: "payment_methods",
      placeholder: "Тип оплаты"
    },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория товара"
    },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    {
      kind: "multiSelect",
      paramKey: "supervisor_ids",
      optionsFrom: "supervisors",
      placeholder: "Супервайзер"
    },
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
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "phone", header: "Телефон" },
    { key: "address", header: "Адрес" },
    { key: "city", header: "Город" },
    { key: "agent_name", header: "Агент" },
    { key: "supervisor_name", header: "Супервайзер" },
    { key: "inventory_types", header: "Тип инвентаря" },
    { key: "equipment_count", header: "Инв.", align: "right", format: "number" },
    { key: "order_count", header: "Заказов", align: "right", format: "number" },
    { key: "qty", header: "Кол-во", align: "right", format: "number" },
    { key: "amount", header: "Сумма", align: "right", format: "money" }
  ],
  totalsKeys: ["equipment_count", "order_count", "qty", "amount"],
  totalsLabels: {
    equipment_count: "Инвентарь",
    order_count: "Заказов",
    qty: "Кол-во",
    amount: "Сумма"
  },
  rowKey: "client_id",
  countLabel: "Клиентов",
  footerLeadColSpan: 8,
  clientTableSearch: {
    rowKeys: ["client_name", "phone", "address", "agent_name", "inventory_types", "city"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportInventoryPage() {
  return <FlatReportPage {...config} />;
}
