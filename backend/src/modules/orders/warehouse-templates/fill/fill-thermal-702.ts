import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell, fmtRuDateTimeShort, cellStr } from "../warehouse-template-fill.helpers";
import { metaAgents } from "../warehouse-template-shared";
import { sumLines } from "../warehouse-template-fill.helpers";

export function fillThermal702(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  setCell(ws, 2, 1, `Менеджер(ы): ${metaAgents(ctx)}`);
  setCell(ws, 3, 1, `Количество заказов: ${ctx.orders.length}`);
  setCell(ws, 4, 1, fmtRuDateTimeShort(ctx.now));

  const colBlock = 1;
  let row = 6;
  const groupKeys = [...ctx.linesByGroup.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  for (const gk of groupKeys) {
    const groupLines = ctx.linesByGroup.get(gk)!.filter((l) => l.qty > 0);
    if (groupLines.length === 0) continue;
    setCell(ws, row, colBlock, gk.toUpperCase());
    row++;
    let n = 1;
    for (const ln of groupLines) {
      setCell(ws, row, colBlock, n++);
      setCell(ws, row, colBlock + 2, ln.name);
      setCell(ws, row, colBlock + 8, `${ln.qty}к`);
      row++;
    }
    const t = sumLines(groupLines);
    setCell(ws, row, colBlock, `(${t.qty})          ${Math.round(t.sum).toLocaleString("ru-RU")}`);
    row += 2;
  }
}
