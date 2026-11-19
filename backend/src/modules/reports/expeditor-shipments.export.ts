import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseExpeditorShipmentsQuery } from "./expeditor-shipments.parse";
import { getExpeditorShipmentsReport } from "./expeditor-shipments.report";

function colKey(id: number | null): string {
  return id == null ? "none" : String(id);
}

export async function exportExpeditorShipmentsXlsx(
  tenantId: number,
  rawQ: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const cap = Math.min(5000, Math.max(1, Number.parseInt(rawQ.export_limit ?? "2000", 10) || 2000));
  const f = parseExpeditorShipmentsQuery({ ...rawQ, page: "1", limit: String(cap) });
  const report = await getExpeditorShipmentsReport(tenantId, f, actor);
  const truncated = report.total > cap;

  const header1: Array<string | number> = ["Категория", "Товар"];
  const header2: Array<string | number> = ["", ""];
  for (const col of report.columns) {
    header1.push(col.expeditor_name, "", "", "");
    header2.push("Блок", "Объем", "Количество", "Сумма");
  }

  const rows = report.rows.map((r) => {
    const line: Array<string | number> = [r.category_name, r.product_name];
    for (const col of report.columns) {
      const cell = r.cells[colKey(col.expeditor_id)];
      line.push(
        cell?.block_count ?? 0,
        Number.parseFloat(cell?.volume ?? "0"),
        Number.parseFloat(cell?.qty ?? "0"),
        Number.parseFloat(cell?.amount ?? "0")
      );
    }
    return line;
  });

  const totalLine: Array<string | number> = ["", "Итого"];
  const invLine: Array<string | number> = ["", "Кол-во накладных"];
  for (const col of report.columns) {
    const t = report.column_totals[colKey(col.expeditor_id)];
    totalLine.push(
      t?.block_count ?? 0,
      Number.parseFloat(t?.volume ?? "0"),
      Number.parseFloat(t?.qty ?? "0"),
      Number.parseFloat(t?.amount ?? "0")
    );
    invLine.push(t?.invoice_count ?? 0, "", "", "");
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header1, header2, ...rows, totalLine, invLine]);
  ws["!cols"] = [{ wch: 16 }, { wch: 24 }, ...report.columns.flatMap(() => [{ wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }])];
  XLSX.utils.book_append_sheet(wb, ws, "Отгрузки");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: report.total, truncated };
}
