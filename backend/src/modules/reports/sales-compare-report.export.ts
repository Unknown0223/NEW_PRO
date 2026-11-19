import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseSalesCompareReportQuery } from "./sales-compare-report.parse";
import { getSalesCompareReport } from "./sales-compare-report.report";

export async function exportSalesCompareReportXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(10000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "5000", 10) || 5000));
  const f = parseSalesCompareReportQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getSalesCompareReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const headers = [
    "#",
    "Название",
    "Сумма A",
    "Сумма B",
    "Разница",
    "Разница %",
    "Заказов A",
    "Заказов B",
    "АКБ A",
    "АКБ B",
    "Средний A",
    "Средний B"
  ];
  const rows = report.rows.map((r) => [
    r.row_number,
    r.name,
    r.sum_a,
    r.sum_b,
    r.diff_sum,
    r.diff_pct ?? "",
    r.orders_a,
    r.orders_b,
    r.akb_a,
    r.akb_b,
    r.avg_a,
    r.avg_b
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws["!cols"] = headers.map(() => ({ wch: 14 }));
  XLSX.utils.book_append_sheet(wb, ws, "Сравнение");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}