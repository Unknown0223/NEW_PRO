import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell, fmtRuDateShort, cellStr } from "../warehouse-template-fill.helpers";

const COL = {
  num: 1,
  name: 2,
  unit: 3,
  qty: 4,
  price: 5,
  sum: 6,
  returnQty: 7,
  returnSum: 8,
  consignmentNo: 9,
  consignmentSum: 10
} as const;

const DATA_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

function stripExpeditorLine(line: string): string {
  return line
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(\d{2}\.\d{2}\.\d{4}\).*$/, "")
    .trim();
}

function clearCell(ws: ExcelJS.Worksheet, row: number, col: number) {
  const cell = ws.getCell(row, col);
  cell.value = null;
}

function findItogoRow(ws: ExcelJS.Worksheet, fromRow: number): number {
  for (let r = fromRow; r <= ws.rowCount; r++) {
    if (cellStr(ws.getCell(r, COL.name).value) === "ИТОГО") return r;
  }
  return -1;
}

function roundMoney(n: number): number | "" {
  if (!Number.isFinite(n) || n === 0) return "";
  return Math.round(n);
}

export function fillPerExpeditor701(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  const blocks = ctx.expeditorBlocks.filter((b) => b.lines.some((l) => l.qty > 0));

  let searchFrom = 1;
  for (const block of blocks) {
    let headerRow = -1;
    for (let r = searchFrom; r <= ws.rowCount; r++) {
      const c2 = cellStr(ws.getCell(r, COL.name).value);
      if (c2 === "ЭКСПЕДИТОР" || c2.startsWith("ЭКСПЕДИТОР")) {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) break;

    const totalRow = findItogoRow(ws, headerRow + 1);
    if (totalRow < 0) break;

    setCell(ws, headerRow, 6, stripExpeditorLine(block.expeditorLine));
    setCell(ws, headerRow - 1, 7, fmtRuDateShort(ctx.now));

    for (let r = headerRow + 1; r < totalRow; r++) {
      for (const c of DATA_COLS) {
        clearCell(ws, r, c);
      }
    }

    let row = headerRow + 1;
    let idx = 1;
    let totalQty = 0;
    let totalSum = 0;

    for (const ln of block.lines) {
      if (ln.qty <= 0) continue;
      setCell(ws, row, COL.num, idx++);
      setCell(ws, row, COL.name, ln.name);
      setCell(ws, row, COL.unit, "шт.");
      setCell(ws, row, COL.qty, ln.qty);
      setCell(ws, row, COL.price, roundMoney(ln.price));
      setCell(ws, row, COL.sum, roundMoney(ln.sum));
      setCell(ws, row, COL.returnQty, 0);
      setCell(ws, row, COL.returnSum, 0);
      setCell(ws, row, COL.consignmentNo, "");
      setCell(ws, row, COL.consignmentSum, 0);
      totalQty += ln.qty;
      totalSum += ln.sum;
      row++;
    }

    setCell(ws, totalRow, COL.qty, totalQty);
    setCell(ws, totalRow, COL.sum, roundMoney(totalSum));
    setCell(ws, totalRow, COL.returnQty, 0);
    setCell(ws, totalRow, COL.returnSum, 0);
    setCell(ws, totalRow, COL.consignmentSum, 0);

    searchFrom = totalRow + 2;
  }
}
