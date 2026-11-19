import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseDailyVisitsReportQuery } from "./daily-visits-report.parse";
import { getDailyVisitsReport } from "./daily-visits-report.report";

export async function exportDailyVisitsReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseDailyVisitsReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getDailyVisitsReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Дата",
    "Агент",
    "Посещённые",
    "План",
    "Непосещенные",
    "Заказы",
    "Фотоотчёты",
    "Отказы",
    "% посещ."
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.work_date,
    r.agent_name,
    r.visited,
    r.planned,
    r.not_visited,
    r.orders_count,
    r.photo_reports,
    r.refusals,
    r.visit_pct
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Дневное посещение");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
