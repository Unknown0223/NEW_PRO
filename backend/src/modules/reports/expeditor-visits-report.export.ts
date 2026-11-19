import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseExpeditorVisitsReportQuery } from "./expeditor-visits-report.parse";
import { getExpeditorVisitsReport } from "./expeditor-visits-report.report";

export async function exportExpeditorVisitsReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseExpeditorVisitsReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getExpeditorVisitsReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Доставщик",
    "Плановый визит",
    "Посещено",
    "Не посещено",
    "Доставка фактов",
    "Полный возврат",
    "Оплата"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.expeditor_name,
    r.planned,
    r.visited,
    r.no_visited,
    r.order_count,
    r.defect_count,
    r.payment_sum
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Визиты экспедиторов");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
