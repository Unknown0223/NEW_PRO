"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha (dual dateRange A/B + group_by) · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";
import { formatNumberGrouped } from "@/lib/format-numbers";

function fmtNum(v: unknown, digits = 2) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v ?? "—");
  return formatNumberGrouped(n, { maxFractionDigits: digits });
}

function fmtPct(v: unknown) {
  if (v == null || v === "") return "—";
  return `${fmtNum(v, 2)}%`;
}

const config: FlatReportConfig = {
  title: "Сравнительный анализ продаж",
  apiPath: "sales-compare",
  exportPermission: "reports.sravnitelnyy_analiz.export",
  exportFilename: "sravnitelnyy-analiz-prodazh.xlsx",
  filterFields: [
    {
      kind: "dateRange",
      fromKey: "from_a",
      toKey: "to_a",
      label: "Период A",
      defaultRange: "prev_month"
    },
    { kind: "dateRange", fromKey: "from_b", toKey: "to_b", label: "Период B" },
    { kind: "select", paramKey: "group_by", optionsFrom: "group_by", defaultValue: "product" },
    { kind: "search", placeholder: "Поиск" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "category_ids",
      optionsFrom: "categories",
      placeholder: "Категория товара"
    }
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "name", header: "Название", cellClassName: "font-medium" },
    { key: "sum_a", header: "Сумма A", align: "right", format: "money" },
    { key: "sum_b", header: "Сумма B", align: "right", format: "money" },
    { key: "diff_sum", header: "Разница", align: "right", format: "money" },
    { key: "diff_pct", header: "Δ %" },
    { key: "orders_a", header: "Заказов A", align: "right", format: "number" },
    { key: "orders_b", header: "Заказов B", align: "right", format: "number" },
    { key: "akb_a", header: "АКБ A", align: "right", format: "number" },
    { key: "akb_b", header: "АКБ B", align: "right", format: "number" },
    { key: "avg_a", header: "Средний A", align: "right", format: "money" },
    { key: "avg_b", header: "Средний B", align: "right", format: "money" }
  ],
  totalsKeys: ["sum_a", "sum_b", "diff_sum"],
  totalsLabels: { sum_a: "Сумма A", sum_b: "Сумма B", diff_sum: "Δ" },
  rowKey: "row_number",
  countLabel: "Всего",
  showTableFooter: false,
  formatters: {
    diff_pct: (v) => fmtPct(v)
  }
};

export default function ReportSalesComparePage() {
  return <FlatReportPage {...config} />;
}
