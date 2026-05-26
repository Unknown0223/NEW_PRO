import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { lookupLine, metaExpeditors, bonusLabel } from "../warehouse-template-shared";
import { findSheetByPart, setCell, cellStr } from "../warehouse-template-fill.helpers";
import { scanTemplateSkuRows, clearNumericDataColumns } from "../warehouse-template-sanitize";

function fillDualBlock(
  ws: ExcelJS.Worksheet,
  ctx: WarehouseAggregateContext,
  skuCol: number,
  dataCols: { unit: number; qty: number; price: number; sum: number; bonus: number },
  useBonusOnly: boolean
) {
  const rows = scanTemplateSkuRows(ws, skuCol, 5);
  clearNumericDataColumns(ws, 5, ws.rowCount, [
    dataCols.unit,
    dataCols.qty,
    dataCols.price,
    dataCols.sum,
    dataCols.bonus
  ]);
  for (const { row, sku } of rows) {
    const ln = lookupLine(ctx, sku) ?? lookupLine(ctx, cellStr(ws.getCell(row, skuCol + 1).value));
    if (!ln) continue;
    if (useBonusOnly) {
      if (ln.bonusQty > 0) setCell(ws, row, dataCols.bonus, bonusLabel(ln.bonusQty));
      continue;
    }
    if (ln.qty > 0) {
      setCell(ws, row, dataCols.unit, "шт.");
      setCell(ws, row, dataCols.qty, ln.qty);
      if (ln.price > 0) setCell(ws, row, dataCols.price, ln.price);
      if (ln.sum > 0) setCell(ws, row, dataCols.sum, ln.sum);
      if (ln.bonusQty > 0) setCell(ws, row, dataCols.bonus, bonusLabel(ln.bonusQty));
    }
  }
}

export function fillCatalogDual110(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const exp = metaExpeditors(ctx);
  const orderSheet = findSheetByPart(wb, "заказ") ?? wb.worksheets[0]!;
  const exchangeSheet = findSheetByPart(wb, "обмен") ?? wb.worksheets[1];

  setCell(orderSheet, 3, 4, exp);
  fillDualBlock(orderSheet, ctx, 1, { unit: 3, qty: 4, price: 5, sum: 6, bonus: 7 }, false);
  if (exchangeSheet) {
    setCell(exchangeSheet, 3, 12, exp);
    fillDualBlock(exchangeSheet, ctx, 9, { unit: 11, qty: 12, price: 13, sum: 14, bonus: 15 }, true);
  }
}
