"use client";

import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

function outletColumns(groupBy: string): FlatReportColumn[] {
  const metrics: FlatReportColumn[] = [
    { key: "order_count", header: "Заказов", align: "right", format: "number" },
    { key: "product_count", header: "Продуктов", align: "right", format: "number" },
    { key: "sales_sum", header: "Сумма", align: "right", format: "money" },
    { key: "avg_check", header: "Средний чек", align: "right", format: "money" }
  ];
  if (groupBy === "class") {
    return [
      { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
      { key: "class_name", header: "Класс", cellClassName: "font-medium" },
      ...metrics
    ];
  }
  return [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "class_name", header: "Класс" },
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "agent_name", header: "Агент" },
    { key: "client_category", header: "Категория" },
    ...metrics
  ];
}

const config: FlatReportConfig = {
  title: "Классификация торговых точек",
  apiPath: "outlet-class",
  exportPermission: "reports.klassifikatsiya_tt.export",
  exportFilename: "klassifikatsiya-tt.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "select", paramKey: "group_by", optionsFrom: "group_by", defaultValue: "client" },
    {
      kind: "bands",
      paramKey: "bands",
      defaultValue: "A:1000000,B:500000,C:100000,D:0",
      defaultFromOptionsKey: "default_bands",
      placeholder: "A:1000000,B:500000,…"
    },
    { kind: "search", placeholder: "Клиент / агент" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
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
  columns: ({ applied }) => outletColumns(String(applied.group_by ?? "client")),
  totalsKeys: ["client_count", "order_count", "sales_sum"],
  totalsLabels: { client_count: "Клиентов", order_count: "Заказов", sales_sum: "Сумма" },
  rowKey: "row_number",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["class_name", "client_name", "agent_name", "client_category"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportOutletClassPage() {
  return <FlatReportPage {...config} />;
}
