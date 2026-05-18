import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { EXPORT_CAP } from "./visit-totals.types";
import { parseVisitTotalsQuery } from "./visit-totals.parse";
import { getVisitTotalsReport } from "./visit-totals.report";

export async function exportVisitTotalsXlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const vf = { ...parseVisitTotalsQuery(q), page: 1, limit: EXPORT_CAP };
  const payload = await getVisitTotalsReport(tenantId, vf, actor);
  const truncated = payload.total > EXPORT_CAP;
  const rows = truncated ? payload.rows.slice(0, EXPORT_CAP) : payload.rows;

  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "№",
      "Агент",
      "Дата",
      "Первая активность",
      "Последняя активность",
      "План",
      "Посещенные",
      "Не посещенные",
      "Общее кол.во заказов",
      "Общая сумма заказов",
      "% визитов",
      "Конверсия заказ/визит",
      "Средний чек"
    ],
    ...rows.map((r) => [
      r.row_number,
      r.agent_label,
      r.work_date,
      r.first_activity_at ? r.first_activity_at.slice(0, 19).replace("T", " ") : "",
      r.last_activity_at ? r.last_activity_at.slice(0, 19).replace("T", " ") : "",
      r.planned,
      r.visited,
      r.not_visited,
      r.orders_count,
      r.sales_sum,
      r.visit_completion_pct,
      r.conversion_orders_per_visit,
      r.avg_order_value
    ])
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "itogi");
  const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  return { buffer, total: payload.total, truncated };
}

/**
 * Dashboard `visit_report` bilan bir kun uchun solishtirish (test).
 */
