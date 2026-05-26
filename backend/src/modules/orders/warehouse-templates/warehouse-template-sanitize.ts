import type ExcelJS from "exceljs";
import { cellStr, clearRange } from "./warehouse-template-fill.helpers";

/** Demo qiymatlarni tozalash — SKU/qator strukturasini saqlab. */
export function clearNumericDataColumns(
  ws: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
  cols: number[]
) {
  for (let r = startRow; r <= endRow; r++) {
    for (const c of cols) {
      const cell = ws.getCell(r, c);
      if (cell.formula) continue;
      const v = cell.value;
      if (typeof v === "number") cell.value = null;
    }
  }
}

/** SKU ustunidan qatorlar ro‘yxatini olish (andoza tartibi). */
export function scanTemplateSkuRows(
  ws: ExcelJS.Worksheet,
  skuCol: number,
  startRow: number,
  maxRow?: number
): Array<{ row: number; sku: string; name: string }> {
  const end = maxRow ?? ws.rowCount;
  const out: Array<{ row: number; sku: string; name: string }> = [];
  for (let r = startRow; r <= end; r++) {
    const sku = cellStr(ws.getCell(r, skuCol).value);
    if (!sku || sku === "№" || sku === "Итого" || sku === "ИТОГО") continue;
    if (/^итого$/i.test(sku)) continue;
    const name = cellStr(ws.getCell(r, skuCol + 1).value);
    out.push({ row: r, sku, name });
  }
  return out;
}

export function removeEmptyWorksheets(wb: ExcelJS.Workbook) {
  for (let i = wb.worksheets.length - 1; i >= 0; i--) {
    const ws = wb.worksheets[i]!;
    const name = (ws.name || "").trim().toLowerCase();
    if (name === "worksheet" || (ws.rowCount === 0 && ws.columnCount === 0)) {
      if (wb.worksheets.length > 1) wb.removeWorksheet(ws.id);
    }
  }
}

export function trimTrailingEmptyRows(ws: ExcelJS.Worksheet, fromRow: number) {
  let last = ws.rowCount;
  while (last >= fromRow) {
    let empty = true;
    for (let c = 1; c <= Math.min(ws.columnCount, 20); c++) {
      if (cellStr(ws.getCell(last, c).value)) {
        empty = false;
        break;
      }
    }
    if (!empty) break;
    last--;
  }
  if (last < ws.rowCount) {
    ws.spliceRows(last + 1, ws.rowCount - last);
  }
}

export function clearSheetDataBand(ws: ExcelJS.Worksheet, row: number, c1: number, c2: number) {
  clearRange(ws, row, c1, row, c2);
}
