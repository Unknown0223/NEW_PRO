"use client";

import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

function bonusesColumns(groupBy: string): FlatReportColumn[] {
  const metrics: FlatReportColumn[] = [
    { key: "qty", header: "Кол-во", align: "right", format: "number" },
    { key: "volume_m3", header: "Объём", align: "right", format: "number" },
    { key: "akb", header: "АКБ", align: "right", format: "number" },
    { key: "order_count", header: "Заказов", align: "right", format: "number" }
  ];
  if (groupBy === "client") {
    return [
      { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
      { key: "name", header: "Клиент", cellClassName: "font-medium" },
      { key: "category_name", header: "Категория" },
      { key: "agent_name", header: "Агент" },
      ...metrics
    ];
  }
  if (groupBy === "product") {
    return [
      { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
      { key: "name", header: "Название", cellClassName: "font-medium" },
      { key: "sku", header: "SKU" },
      { key: "category_name", header: "Категория" },
      ...metrics
    ];
  }
  return [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    {
      key: "name",
      header: groupBy === "agent" ? "Агент" : "Категория",
      cellClassName: "font-medium"
    },
    ...metrics
  ];
}

const config: FlatReportConfig = {
  title: "По бонусам",
  apiPath: "bonuses",
  exportPermission: "reports.po_bonusam.export",
  exportFilename: "po-bonusam.xlsx",
  tablePrefsId: "report.bonuses.v1",
  dateTypeAsRadio: true,
  /** group_by + multi-selectlar → xl 9 ≈ 1–2 qator. */
  filterGridCols: 9,
  filterFields: [
    { kind: "dateRange" },
    { kind: "select", paramKey: "date_type", optionsFrom: "date_types", defaultValue: "created_at" },
    { kind: "select", paramKey: "group_by", optionsFrom: "group_by", defaultValue: "product" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория товара"
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
  columns: ({ applied }) => bonusesColumns(String(applied.group_by ?? "product")),
  totalsKeys: ["qty", "volume_m3", "akb"],
  totalsLabels: { qty: "Кол-во", volume_m3: "Объём", akb: "АКБ" },
  rowKey: "group_key",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["name", "sku", "category_name", "agent_name", "client_name"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportBonusesPage() {
  return <FlatReportPage {...config} />;
}
