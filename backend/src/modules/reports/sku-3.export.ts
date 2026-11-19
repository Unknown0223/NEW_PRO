import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseSku3Query } from "./sku-3.parse";
import { getSku3Report } from "./sku-3.report";

export async function exportSku3Xlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(5000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "2000", 10) || 2000));
  const f = parseSku3Query({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getSku3Report(tenantId, f, actor);
  const truncated = report.total > cap;

  const header1: Array<string | number> = ["Торговая точка"];
  const header2: Array<string | number> = [""];
  for (const p of report.products) {
    header1.push(p.product_name, "");
    header2.push("Сумма", "Количество");
  }

  const rows = report.rows.map((r) => {
    const line: Array<string | number> = [r.client_name];
    for (const p of report.products) {
      const cell = r.cells[String(p.product_id)];
      line.push(Number.parseFloat(cell?.amount ?? "0"), Number.parseFloat(cell?.qty ?? "0"));
    }
    return line;
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...rows]);
  ws["!cols"] = [{ wch: 28 }, ...report.products.flatMap(() => [{ wch: 12 }, { wch: 12 }])];
  XLSX.utils.book_append_sheet(wb, ws, "По SKU");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
