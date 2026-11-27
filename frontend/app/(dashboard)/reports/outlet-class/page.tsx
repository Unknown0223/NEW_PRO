"use client";

import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type {
  FlatReportColumn,
  FlatReportColumnsContext,
  FlatReportConfig
} from "@/components/reports/flat-report/types";
import { formatOutletClassRowLabel } from "@/lib/outlet-class-bands";

function outletColumns(ctx: FlatReportColumnsContext): FlatReportColumn[] {
  const groupBy = String(ctx.applied.group_by ?? "class");
  const catCols = Array.isArray(ctx.reportData?.category_columns)
    ? (ctx.reportData!.category_columns as string[])
    : [];

  const base: FlatReportColumn[] = [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "class_name", header: "Классификация", cellClassName: "font-medium" },
    { key: "client_code", header: "Идентификация клиента" },
    { key: "territory", header: "Территория" },
    { key: "client_count", header: "Кол-во клиентов", align: "right", format: "number" },
    { key: "order_count", header: "Кол-во заказов", align: "right", format: "number" },
    { key: "product_count", header: "Кол-во продуктов", align: "right", format: "number" },
    { key: "sales_sum", header: "Сумма", align: "right", format: "money" },
    { key: "avg_check", header: "Средний чек", align: "right", format: "money" }
  ];

  if (groupBy === "client") {
    base.splice(
      2,
      0,
      { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
      { key: "agent_name", header: "Агент" }
    );
  }

  for (const name of catCols) {
    base.push({
      key: `cat_${name}`,
      header: name,
      align: "right",
      format: "number",
      valueFrom: (row) => {
        const shares = row.category_shares as Record<string, string> | undefined;
        return shares?.[name] ?? "0";
      }
    });
  }
  return base;
}

const config: FlatReportConfig = {
  title: "Классификация торговых точек",
  apiPath: "outlet-class",
  exportPermission: "reports.klassifikatsiya_tt.export",
  exportFilename: "klassifikatsiya-tt.xlsx",
  tablePrefsId: "report.outlet-class.v2",
  filterGridCols: 9,
  filterFields: [
    { kind: "dateRange" },
    {
      kind: "select",
      paramKey: "group_by",
      optionsFrom: "group_by",
      defaultValue: "class",
      placeholder: "Группировка"
    },
    {
      kind: "bands",
      paramKey: "bands",
      defaultValue: "A:1000000,B:500000,C:100000,D:0",
      defaultFromOptionsKey: "default_bands",
      placeholder: "Пороги"
    },
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
  columns: (ctx) => outletColumns(ctx),
  formatters: (applied) => ({
    class_name: (value) =>
      formatOutletClassRowLabel(String(value ?? ""), String(applied.bands ?? ""))
  }),
  totalsKeys: ["client_count", "order_count", "sales_sum"],
  totalsLabels: { client_count: "Клиентов", order_count: "Заказов", sales_sum: "Сумма" },
  rowKey: "row_number",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["class_name", "client_code", "client_name", "territory", "agent_name", "client_category"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportOutletClassPage() {
  return <FlatReportPage {...config} />;
}
