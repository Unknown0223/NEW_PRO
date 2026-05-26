import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell, fmtRuDateShort, cellStr } from "../warehouse-template-fill.helpers";

function stripExpeditorLine(line: string): string {
  return line
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/\s*\(\d{2}\.\d{2}\.\d{4}\).*$/, "")
    .trim();
}

export function fillPerExpeditor701(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  const blocks = ctx.expeditorBlocks.filter((b) => b.lines.some((l) => l.qty > 0));

  let searchFrom = 1;
  for (const block of blocks) {
    let headerRow = -1;
    for (let r = searchFrom; r <= ws.rowCount; r++) {
      const c2 = cellStr(ws.getCell(r, 2).value);
      if (c2 === "ЭКСПЕДИТОР" || c2 === "ЭКСПЕДИТОР ") {
        headerRow = r;
        break;
      }
    }
    if (headerRow < 0) break;
    setCell(ws, headerRow, 6, stripExpeditorLine(block.expeditorLine));
    setCell(ws, headerRow - 1, 7, fmtRuDateShort(ctx.now));

    let row = headerRow + 1;
    let idx = 1;
    let totalQty = 0;
    let totalSum = 0;
    for (const ln of block.lines) {
      if (ln.qty <= 0) continue;
      if (cellStr(ws.getCell(row, 2).value) === "ИТОГО") break;
      setCell(ws, row, 1, idx++);
      setCell(ws, row, 2, ln.name);
      setCell(ws, row, 3, "шт.");
      setCell(ws, row, 4, ln.qty);
      setCell(ws, row, 5, ln.price);
      setCell(ws, row, 6, ln.sum);
      totalQty += ln.qty;
      totalSum += ln.sum;
      row++;
    }
    const totalRow = row;
    if (cellStr(ws.getCell(totalRow, 2).value) === "ИТОГО") {
      setCell(ws, totalRow, 4, totalQty);
      setCell(ws, totalRow, 6, totalSum);
    }
    searchFrom = totalRow + 2;
  }
}
