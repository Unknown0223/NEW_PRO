import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

export const EXCEL_EXPORT_COLUMNS: FlatReportColumn[] = [
  { key: "order_id", header: "Заказ ID", align: "right", format: "number" },
  { key: "order_number", header: "Номер", cellClassName: "font-medium" },
  { key: "shipped_at", header: "Дата отгрузки" },
  { key: "client_name", header: "Клиент" },
  { key: "client_code", header: "Код клиента" },
  { key: "product_name", header: "Продукт" },
  { key: "qty", header: "Количество", align: "right", format: "number" },
  { key: "status_label", header: "Статус" },
  { key: "agent_name", header: "Агент" },
  { key: "agent_code", header: "Код агента" },
  { key: "expeditor_name", header: "Экспедитор" },
  { key: "expeditor_code", header: "Код экспедитора" },
  { key: "client_category", header: "Сегменты клиентов" },
  { key: "territory", header: "Территория" },
  { key: "price_type", header: "Тип цены" },
  { key: "payment_method", header: "Тип оплаты" },
  { key: "product_category", header: "Категории продуктов" },
  { key: "unit", header: "Единица" },
  { key: "price", header: "Цена", align: "right", format: "money" },
  { key: "amount", header: "Сумма", align: "right", format: "money" },
  { key: "discount", header: "discount", align: "right", format: "money" },
  { key: "order_date", header: "Дата заявки" },
  { key: "delivered_at", header: "Дата доставки" }
];

export const EXCEL_EXPORT_DEFAULT_VISIBLE = [
  "order_id",
  "shipped_at",
  "client_name",
  "product_name",
  "qty",
  "status_label",
  "agent_name",
  "expeditor_name",
  "territory",
  "price",
  "amount"
] as const;

export const EXCEL_EXPORT_FILTER_CONFIG: FlatReportConfig = {
  title: "Excel экспорт",
  apiPath: "excel-export",
  exportPermission: "reports.excel_eksport.export",
  exportFilename: "excel-eksport-v1.xlsx",
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
      placeholder: "Категория"
    },
    {
      kind: "multiSelect",
      paramKey: "product_ids",
      optionsFrom: "products",
      placeholder: "Продукты"
    },
    {
      kind: "multiSelect",
      paramKey: "client_categories",
      optionsFrom: "client_categories",
      placeholder: "Сегменты клиентов"
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
  columns: EXCEL_EXPORT_COLUMNS,
  totalsKeys: [],
  rowKey: "row_number",
  dateTypeAsRadio: true
};
