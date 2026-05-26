import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { metaExpeditors } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell } from "../warehouse-template-fill.helpers";

export function fillListSimple112(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  setCell(ws, 3, 4, metaExpeditors(ctx));

  let row = 5;
  let idx = 1;
  for (const ln of ctx.lines) {
    if (ln.qty <= 0 && ln.bonusQty <= 0) continue;
    setCell(ws, row, 1, idx++);
    setCell(ws, row, 2, ln.name);
    if (ln.qty > 0) {
      setCell(ws, row, 3, "шт.");
      setCell(ws, row, 4, ln.qty);
      setCell(ws, row, 5, ln.price);
      setCell(ws, row, 6, ln.sum);
    }
    if (ln.bonusQty > 0) setCell(ws, row, 7, `${ln.bonusQty} бонус`);
    row++;
  }
}
