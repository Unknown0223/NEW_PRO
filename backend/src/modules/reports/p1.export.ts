import * as XLSX from "xlsx";
import type { ReportActor } from "./client-sales-4-report.service";
import { parseP1ReportQuery } from "./p1.parse";
import { monthPeriodLabel } from "./p1.pure";
import { getP1Report } from "./p1.report";
import type { P1Metric, P1MonthCol } from "./p1.types";

function cellVals(m: P1Metric | undefined): [number, number, number] {
  if (!m) return [0, 0, 0];
  return [m.akb, Number(m.qty), Number(m.total)];
}

type PeriodGroup = {
  title: string;
  ly?: P1MonthCol;
  cy?: P1MonthCol;
};

function groupPeriods(months: P1MonthCol[], year: number, compareYear: number): PeriodGroup[] {
  const map = new Map<string, PeriodGroup>();
  const order: string[] = [];
  for (const col of months) {
    const id =
      col.kind === "month" ? `m-${col.month}` : col.kind === "quarter" ? `q-${col.month}` : "y";
    let g = map.get(id);
    if (!g) {
      const title =
        col.kind === "month"
          ? monthPeriodLabel(col.month)
          : col.kind === "quarter"
            ? `${col.month} кв.`
            : "Итого";
      g = { title };
      map.set(id, g);
      order.push(id);
    }
    if (col.year === compareYear) g.ly = col;
    if (col.year === year) g.cy = col;
  }
  return order.map((id) => map.get(id)!);
}

export async function exportP1ReportXlsx(
  tenantId: number,
  q: Record<string, string | undefined>,
  actor?: ReportActor
): Promise<{ buffer: Buffer; total: number; truncated: boolean }> {
  const filters = parseP1ReportQuery(q);
  const data = await getP1Report(tenantId, filters, actor);
  const groups = groupPeriods(data.months, data.year, data.compare_year);

  const headerPeriod: Array<string | number> = ["Область", "Продукт"];
  const headerYear: Array<string | number> = ["", ""];
  const headerMetric: Array<string | number> = ["", ""];

  for (const g of groups) {
    const span = (g.ly ? 3 : 0) + (g.cy ? 3 : 0);
    headerPeriod.push(g.title, ...Array(Math.max(span - 1, 0)).fill(""));
    if (g.ly) {
      headerYear.push(String(data.compare_year), "", "");
      headerMetric.push("АКБ", "Кол-во", "Сумма");
    }
    if (g.cy) {
      headerYear.push(String(data.year), "", "");
      headerMetric.push("АКБ", "Кол-во", "Сумма");
    }
  }

  const aoa: Array<Array<string | number>> = [headerPeriod, headerYear, headerMetric];

  for (const row of data.rows) {
    const productLabel =
      row.kind === "region" ? "Продукт" : row.kind === "grand_total" ? "" : (row.product_name ?? "");
    const line: Array<string | number> = [row.region_label, productLabel];
    for (const g of groups) {
      if (g.ly) {
        const [akb, qty, total] = cellVals(row.cells[g.ly.key]);
        line.push(akb, qty, total);
      }
      if (g.cy) {
        const [akb, qty, total] = cellVals(row.cells[g.cy.key]);
        line.push(akb, qty, total);
      }
    }
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "P1");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, total: data.rows.length, truncated: false };
}
