import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { metaExpeditors } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell } from "../warehouse-template-fill.helpers";
import { DEFAULT_WAREHOUSE_EXPORT_OPTIONS } from "../warehouse-export-options";

export function fillListSimple112(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions
) {
  const ws = primaryDataSheet(wb);
  const exp = options.warehouseExport ?? DEFAULT_WAREHOUSE_EXPORT_OPTIONS;
  setCell(ws, 3, 4, metaExpeditors(ctx));

  let lines = [...ctx.lines].filter((ln) => ln.qty > 0 || ln.bonusQty > 0);
  if (exp.sortProducts !== false) {
    lines.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }

  let row = 5;
  let idx = 1;
  for (const ln of lines) {
    setCell(ws, row, 1, idx++);
    setCell(ws, row, 2, ln.name);
    if (ln.qty > 0) {
      setCell(ws, row, 3, "шт.");
      setCell(ws, row, 4, ln.qty);
      setCell(ws, row, 5, ln.price > 0 ? Math.round(ln.price) : "");
      setCell(ws, row, 6, ln.sum > 0 ? Math.round(ln.sum) : "");
    }
    if (ln.bonusQty > 0) setCell(ws, row, 7, `${ln.bonusQty} бонус`);
    row++;
  }
}
