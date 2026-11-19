import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseVisitsReportQuery } from "./visits-report.parse";
import { getVisitsReport } from "./visits-report.report";

export async function exportVisitsReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseVisitsReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getVisitsReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Название",
    "ОКБ",
    "АКБ",
    "Кол-во заказ.",
    "Сумма",
    "Отказы",
    "Фотоотчёты",
    "Посещённые",
    "Непосещенные",
    "План",
    "% посещ."
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.agent_name,
    r.okb,
    r.akb,
    r.orders_count,
    r.sales_sum,
    r.refusals,
    r.photo_reports,
    r.visited,
    r.not_visited,
    r.planned,
    r.visit_pct
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "По визитам");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
