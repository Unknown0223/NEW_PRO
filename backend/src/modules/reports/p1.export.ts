import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseP1ReportQuery } from "./p1.parse";
import { getP1Report } from "./p1.report";
import type { P1Metric } from "./p1.types";

function cellVals(m: P1Metric | undefined): [number, number, number] {
  if (!m) return [0, 0, 0];
  return [m.akb, Number(m.qty), Number(m.total)];
}

export async function exportP1ReportXlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const filters = parseP1ReportQuery(q);
  const data = await getP1Report(tenantId, filters, actor);

  const aoa: Array<Array<string | number>> = [];
  const header1: Array<string | number> = ["Область", "Продукт"];
  const header2: Array<string | number> = ["", ""];
  for (const col of data.months) {
    header1.push(col.label, "", "");
    header2.push("АКБ", "Кол-во", "Сумма");
  }
  aoa.push(header1, header2);

  for (const row of data.rows) {
    const productLabel =
      row.kind === "region" ? "Продукт" : row.kind === "grand_total" ? "" : (row.product_name ?? "");
    const line: Array<string | number> = [row.region_label, productLabel];
    for (const col of data.months) {
      const [akb, qty, total] = cellVals(row.cells[col.key]);
      line.push(akb, qty, total);
    }
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "P1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: data.rows.length, truncated: false };
}
