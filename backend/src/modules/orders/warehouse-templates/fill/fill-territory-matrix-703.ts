import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";
import { metaTerritories } from "../warehouse-template-shared";

export function fillTerritoryMatrix703(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  setCell(ws, 3, 2, `Реализация товара за ${ctx.now.getDate()} ${["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"][ctx.now.getMonth()]} ${ctx.now.getFullYear()} г.`);
  setCell(ws, 4, 4, metaTerritories(ctx).split(",")[0]?.trim() ?? "");

  const storeHeaders: Array<{ col: number; name: string }> = [];
  for (let c = 4; c <= Math.min(ws.columnCount, 80); c += 2) {
    const name = cellStr(ws.getCell(5, c).value);
    if (name) storeHeaders.push({ col: c, name });
  }

  for (let row = 9; row <= ws.rowCount; row++) {
    const prod = cellStr(ws.getCell(row, 2).value);
    if (!prod || prod === "Цена") continue;
    for (const cc of ctx.clientColumns) {
      const hdr = storeHeaders.find(
        (h) =>
          h.name.toLowerCase() === cc.clientName.toLowerCase() ||
          cc.clientName.toLowerCase().includes(h.name.toLowerCase().slice(0, 8))
      );
      if (!hdr) continue;
      const ol = cc.lines.find((l) => norm(l.name) === norm(prod));
      if (ol && ol.qty > 0) setCell(ws, row, hdr.col + 1, ol.qty);
    }
  }
}

function norm(s: string): string {
  return s.trim().toUpperCase();
}
