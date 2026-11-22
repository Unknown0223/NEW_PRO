"use client";

import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

function cumulativeColumns(groupBy: string): FlatReportColumn[] {
  const lead: FlatReportColumn[] = [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "name", header: groupBy === "rule" ? "Правило" : groupBy === "agent" ? "Агент" : "Клиент", cellClassName: "font-medium" }
  ];
  if (groupBy === "rule") {
    return [
      ...lead,
      { key: "order_count", header: "Заказов", align: "right", format: "number" },
      { key: "akb", header: "АКБ", align: "right", format: "number" }
    ];
  }
  if (groupBy === "agent") {
    return [
      ...lead,
      { key: "purchase_sum", header: "Сумма закупа", align: "right", format: "number" },
      { key: "bonus_qty", header: "Бонус кол-во", align: "right", format: "number" },
      { key: "bonus_sum", header: "Общий бонус", align: "right", format: "number" },
      { key: "order_count", header: "Заказов", align: "right", format: "number" },
      { key: "akb", header: "АКБ", align: "right", format: "number" },
      { key: "rules_count", header: "Правил", align: "right", format: "number" }
    ];
  }
  return [
    ...lead,
    { key: "agent_name", header: "Агент" },
    { key: "purchase_sum", header: "Сумма закупа", align: "right", format: "number" },
    { key: "bonus_qty", header: "Бонус кол-во", align: "right", format: "number" },
    { key: "bonus_sum", header: "Общий бонус", align: "right", format: "number" },
    { key: "order_count", header: "Заказов", align: "right", format: "number" },
    { key: "rules_count", header: "Правил", align: "right", format: "number" }
  ];
}

const config: FlatReportConfig = {
  title: "Накопительный бонус",
  apiPath: "cumulative-bonus",
  exportPermission: "reports.nakopitelnyy_bonus.export",
  exportFilename: "nakopitelnyy-bonus.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "select", paramKey: "date_type", optionsFrom: "date_types", defaultValue: "created_at" },
    { kind: "select", paramKey: "group_by", optionsFrom: "group_by", defaultValue: "client" },
    { kind: "search", placeholder: "Клиент / агент" },
    { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "bonus_rule_ids",
      optionsFrom: "bonus_rules",
      placeholder: "Бонус-правило"
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
  columns: ({ applied }) => cumulativeColumns(String(applied.group_by ?? "client")),
  totalsKeys: ["purchase_sum", "bonus_qty", "akb"],
  totalsLabels: { purchase_sum: "Закуп", bonus_qty: "Бонус", akb: "АКБ" },
  rowKey: "group_key",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["name", "agent_name", "client_name", "rule_name"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportCumulativeBonusPage() {
  return <FlatReportPage {...config} />;
}
