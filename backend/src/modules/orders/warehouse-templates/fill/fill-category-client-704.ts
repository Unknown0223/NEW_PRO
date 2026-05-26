import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { lookupLine, blockLabel } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";

export function fillCategoryClient704(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  const clientCols: Array<{ col: number; header: string }> = [];
  for (let c = 4; c <= Math.min(ws.columnCount, 60); c++) {
    const h = cellStr(ws.getCell(2, c).value);
    if (h.startsWith("Клиент:")) clientCols.push({ col: c, header: h });
  }

  const mapClientCol = (clientName: string, agentLine: string): number | undefined => {
    const cn = clientName.toLowerCase();
    for (const { col, header } of clientCols) {
      const h = header.toLowerCase();
      if (h.includes(cn.slice(0, 12))) return col;
      const ag = agentLine.toLowerCase();
      const rm = header.match(/р\.м:([^;]+)/i);
      if (rm && ag.includes(rm[1]!.trim().toLowerCase().slice(0, 8))) return col;
    }
    return undefined;
  };

  for (let row = 3; row <= 19; row++) {
    const cat = cellStr(ws.getCell(row, 1).value);
    const name = cellStr(ws.getCell(row, 2).value);
    if (!name) continue;
    const ln = lookupLine(ctx, name);
    if (!ln) continue;

    let totalQty = 0;
    for (const cc of ctx.clientColumns) {
      const col = mapClientCol(cc.clientName, cc.agentLine);
      if (!col) continue;
      const ol = cc.lines.find((l) => l.productId === ln.productId);
      if (ol && ol.qty > 0) {
        setCell(ws, row, col, blockLabel(ol));
        totalQty += ol.qty;
      }
    }
    if (totalQty > 0) setCell(ws, row, 3, blockLabel({ ...ln, qty: totalQty }));
  }

  // Итог qatori 20
  for (const cc of ctx.clientColumns) {
    const col = mapClientCol(cc.clientName, cc.agentLine);
    if (!col) continue;
    const qty = cc.lines.reduce((a, l) => a + l.qty, 0);
    const sum = cc.lines.reduce((a, l) => a + l.sum, 0);
    if (qty > 0) setCell(ws, 20, col, qty);
    if (sum > 0) setCell(ws, 21, col, sum);
  }
  setCell(ws, 20, 3, ctx.lines.reduce((a, l) => a + l.qty, 0));
}
