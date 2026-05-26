import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { lookupLine } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";

export function fillMatrixClients601(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  const headerRow = 1;
  const clientCols: Array<{ col: number; name: string }> = [];
  for (let c = 3; c <= Math.min(ws.columnCount, 50); c++) {
    const name = cellStr(ws.getCell(headerRow, c).value);
    if (name && name !== "Продукты" && name !== "САП-код") clientCols.push({ col: c, name });
  }

  const nameToCol = new Map<string, number>();
  for (const cc of ctx.clientColumns) {
    const match = clientCols.find(
      (h) =>
        h.name.toLowerCase() === cc.clientName.toLowerCase() ||
        cc.clientName.toLowerCase().includes(h.name.toLowerCase().slice(0, 10))
    );
    if (match) nameToCol.set(cc.key, match.col);
  }

  for (let row = 3; row <= ws.rowCount; row++) {
    const prod = cellStr(ws.getCell(row, 2).value);
    if (!prod || prod === "Итог") continue;
    for (const cc of ctx.clientColumns) {
      const col = nameToCol.get(cc.key);
      if (!col) continue;
      const ol = cc.lines.find((l) => l.name === prod || lookupLine(ctx, prod)?.productId === l.productId);
      if (ol && ol.qty > 0) setCell(ws, row, col, ol.qty);
    }
  }

  // Итог qatori
  const totalRow = ws.rowCount;
  for (const cc of ctx.clientColumns) {
    const col = nameToCol.get(cc.key);
    if (!col) continue;
    const s = cc.lines.reduce((a, l) => a + l.qty, 0);
    if (s > 0) setCell(ws, totalRow, col, s);
  }
}
