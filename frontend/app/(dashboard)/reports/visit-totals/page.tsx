"use client";

/**
 * FlatReport wave-5 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar qisman (BAD_RANGE banner / Card chrome yo‘q) · chrome ha ·
 * oylik/dialog — (defaultRange today) · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportColumn, FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtCell(iso: unknown) {
  if (iso == null || iso === "") return "—";
  try {
    return new Date(String(iso)).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

function fmtDateRu(ymd: unknown) {
  const s = String(ymd ?? "");
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s || "—";
  return `${d}.${m}.${y}`;
}

function visitTotalsColumns(ctx: {
  applied: Record<string, string | number | string[]>;
}): FlatReportColumn[] {
  const from = String(ctx.applied.from ?? "");
  const to = String(ctx.applied.to ?? "");
  const showWorkDate = from !== to;
  const cols: FlatReportColumn[] = [
    { key: "agent_label", header: "Агент", cellClassName: "font-medium" }
  ];
  if (showWorkDate) {
    cols.push({ key: "work_date", header: "Дата" });
  }
  cols.push(
    { key: "first_activity_at", header: "Первая активность" },
    { key: "last_activity_at", header: "Последняя активность" },
    { key: "planned", header: "План", align: "right", format: "number" },
    { key: "visited", header: "Посещено", align: "right", format: "number" },
    { key: "not_visited", header: "Не посещено", align: "right", format: "number" },
    { key: "orders_count", header: "Заказы", align: "right", format: "number" },
    { key: "sales_sum", header: "Сумма", align: "right", format: "money" }
  );
  return cols;
}

const config: FlatReportConfig = {
  title: "Итоги визитов",
  apiPath: "visit-totals",
  exportPermission: "reports.itogi_vizitov.export",
  exportFilename: "itogi-vizitov.xlsx",
  defaultLimit: 10,
  filterFields: [
    { kind: "dateRange", defaultRange: "today" },
    { kind: "search", placeholder: "Агент" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "order_statuses",
      optionsFrom: "order_statuses",
      placeholder: "Статус заказа"
    }
  ],
  columns: visitTotalsColumns,
  totalsKeys: [],
  rowKey: "row_number",
  countLabel: "Строк",
  showTableFooter: false,
  formatters: {
    work_date: (v) => fmtDateRu(v),
    first_activity_at: (v) => fmtCell(v),
    last_activity_at: (v) => fmtCell(v)
  }
};

export default function ReportVisitTotalsPage() {
  return <FlatReportPage {...config} />;
}
