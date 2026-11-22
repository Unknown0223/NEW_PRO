import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseExpeditorShareReportQuery } from "./expeditor-share-report.parse";
import { getExpeditorShareReport } from "./expeditor-share-report.report";

export async function exportExpeditorShareReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseExpeditorShareReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getExpeditorShareReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Доставщик",
    "Заказы",
    "Продажи",
    "Доля, %",
    "АКБ",
    "Оплата"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.expeditor_name,
    r.order_count,
    r.sales_sum,
    r.share_pct,
    r.client_count,
    r.payment_sum
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Доли экспедиторов");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}