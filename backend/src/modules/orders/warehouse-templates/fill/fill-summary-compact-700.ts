import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell, fmtRuDateShort } from "../warehouse-template-fill.helpers";
import { metaAgents, metaExpeditors } from "../warehouse-template-shared";

export function fillSummaryCompact700(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  setCell(ws, 8, 1, `Дата файла: ${fmtRuDateShort(ctx.now)}`);
  setCell(ws, 5, 1, `Экспедитор: ${metaExpeditors(ctx)}`);
  setCell(ws, 4, 1, `Торговый представитель: ${metaAgents(ctx)}`);

  let row = 13;
  for (const cc of ctx.clientColumns) {
    const lines = cc.lines.filter((l) => l.qty > 0 || l.sum > 0);
    if (lines.length === 0) continue;
    setCell(ws, row, 1, cc.clientName);
    setCell(ws, row, 3, lines.reduce((a, l) => a + l.qty, 0));
    setCell(ws, row, 4, lines.reduce((a, l) => a + l.sum, 0));
    row++;
    setCell(ws, row, 1, "Неприкреплённые");
    row++;
    for (const ln of lines) {
      setCell(ws, row, 1, ln.name);
      setCell(ws, row, 2, ln.price);
      setCell(ws, row, 3, ln.qty);
      setCell(ws, row, 4, ln.sum);
      row++;
    }
    row++;
  }
}
