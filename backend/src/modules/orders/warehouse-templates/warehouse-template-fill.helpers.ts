import type ExcelJS from "exceljs";
import type { NakladnoyLine } from "../order-nakladnoy-xlsx.types";
import { fmtDate, fmtMoneyInt } from "../order-nakladnoy-xlsx.format";
import { sanitizeCellValue } from "./warehouse-template-repair";

export function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    const rt = (v as ExcelJS.CellRichTextValue).richText;
    return rt.map((x) => x.text).join("");
  }
  if (typeof v === "object" && "formula" in (v as object)) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    if (r == null) return "";
    if (typeof r === "number" && !Number.isFinite(r)) return "";
    const s = String(r).trim();
    return s === "NaN" ? "" : s;
  }
  if (typeof v === "number" && !Number.isFinite(v)) return "";
  const out = String(v).trim();
  return out === "NaN" ? "" : out;
}

function resolveMergeMaster(cell: ExcelJS.Cell): ExcelJS.Cell {
  let c: ExcelJS.Cell = cell;
  const seen = new Set<ExcelJS.Cell>();
  while (c.isMerged && c.master && !seen.has(c.master)) {
    seen.add(c);
    c = c.master;
  }
  return c;
}

export function setCell(ws: ExcelJS.Worksheet, row: number, col: number, value: ExcelJS.CellValue) {
  const c = ws.getCell(row, col);
  if (value === undefined) return;
  if (c.formula) return;
  const safe = sanitizeCellValue(value);
  resolveMergeMaster(c).value = safe === undefined ? null : safe;
}

export function clearCellValueMerged(ws: ExcelJS.Worksheet, row: number, col: number) {
  const c = ws.getCell(row, col);
  if (c.formula) return;
  resolveMergeMaster(c).value = null;
}

export function clearRange(ws: ExcelJS.Worksheet, r1: number, c1: number, r2: number, c2: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      if (cell.formula) continue;
      cell.value = null;
    }
  }
}

export function findSheetByPart(wb: ExcelJS.Workbook, part: string): ExcelJS.Worksheet | undefined {
  const p = part.toLowerCase();
  return wb.worksheets.find((ws) => (ws.name || "").toLowerCase().includes(p));
}

export function writeLineCols(
  ws: ExcelJS.Worksheet,
  row: number,
  ln: NakladnoyLine,
  cols: { sku?: number; name?: number; unit?: number; qty?: number; price?: number; sum?: number; bonus?: number }
) {
  if (cols.sku != null) setCell(ws, row, cols.sku, ln.sku);
  if (cols.name != null) setCell(ws, row, cols.name, ln.name);
  if (cols.unit != null) setCell(ws, row, cols.unit, "шт.");
  if (cols.qty != null && ln.qty > 0) setCell(ws, row, cols.qty, ln.qty);
  if (cols.price != null && ln.price > 0) setCell(ws, row, cols.price, ln.price);
  if (cols.sum != null && ln.sum > 0) setCell(ws, row, cols.sum, ln.sum);
  if (cols.bonus != null && ln.bonusQty > 0) {
    setCell(ws, row, cols.bonus, `${ln.bonusQty} бонус`);
  }
}

export function findHeaderColumn(
  ws: ExcelJS.Worksheet,
  headerRow: number,
  needle: string,
  maxCol = 12
): number | null {
  const n = needle.toLowerCase();
  for (let c = 1; c <= maxCol; c++) {
    const t = cellStr(ws.getCell(headerRow, c).value).toLowerCase();
    if (t.includes(n)) return c;
  }
  return null;
}

export function fmtRuDateTimeShort(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mi}:${ss} ${dd}.${mm}.${yyyy}`;
}

export function moneyCell(n: number): number | string {
  if (!Number.isFinite(n) || n === 0) return "";
  return n;
}

export function sumLines(lines: NakladnoyLine[]): { qty: number; bonus: number; sum: number } {
  let qty = 0;
  let bonus = 0;
  let sum = 0;
  for (const ln of lines) {
    qty += ln.qty;
    bonus += ln.bonusQty;
    sum += ln.sum;
  }
  return { qty, bonus, sum };
}
