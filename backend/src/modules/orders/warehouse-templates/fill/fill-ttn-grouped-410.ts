import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import { lineCodeDisplay } from "../../order-nakladnoy-xlsx.format";
import type { WarehouseLayoutId } from "../warehouse-template-ids";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { blockLabel, lookupLine, metaExpeditors } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import {
  cellStr,
  setCell,
  fmtRuDateShort,
  sumLines,
  findHeaderColumn
} from "../warehouse-template-fill.helpers";
import { DEFAULT_WAREHOUSE_EXPORT_OPTIONS } from "../warehouse-export-options";
type TtnVariant = "410" | "411" | "412";

function variantOf(layoutId: WarehouseLayoutId): TtnVariant {
  if (layoutId === "wh-4.1.1") return "411";
  if (layoutId === "wh-4.1.2") return "412";
  return "410";
}

function isCategoryRow(ws: ExcelJS.Worksheet, row: number): boolean {
  const c1 = cellStr(ws.getCell(row, 1).value);
  const c2 = cellStr(ws.getCell(row, 2).value);
  if (!c2) return false;
  if (c1 && !/^\d+$/.test(c1)) return false;
  if (/^итого$/i.test(c2)) return false;
  const c3 = cellStr(ws.getCell(row, 3).value);
  const c4 = cellStr(ws.getCell(row, 4).value);
  return !c3 && !c4 && c1 === "";
}

function isProductRow(ws: ExcelJS.Worksheet, row: number): boolean {
  const c1 = cellStr(ws.getCell(row, 1).value);
  return /^\d+$/.test(c1);
}

export function fillTtnGrouped410(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  layoutId: WarehouseLayoutId,
  options: NakladnoyBuildOptions
) {
  const variant = variantOf(layoutId);
  const ws = primaryDataSheet(wb);
  const now = ctx.now;
  const exp = options.warehouseExport ?? DEFAULT_WAREHOUSE_EXPORT_OPTIONS;

  setCell(ws, 1, 7, fmtRuDateShort(now));
  setCell(ws, 3, 2, metaExpeditors(ctx));

  let barcodeCol: number | null = null;
  let skuCol: number | null = null;
  if (layoutId === "wh-4.1") {
    for (const hr of [3, 4, 5]) {
      barcodeCol ??= findHeaderColumn(ws, hr, "штрих");
      skuCol ??= findHeaderColumn(ws, hr, "код");
    }
  }

  for (let row = 5; row <= ws.rowCount; row++) {
    if (!isProductRow(ws, row)) continue;
    const name = cellStr(ws.getCell(row, 2).value);
    const ln = lookupLine(ctx, name);
    if (!ln) continue;

    if (layoutId === "wh-4.1") {
      if (barcodeCol != null) {
        setCell(
          ws,
          row,
          barcodeCol,
          exp.showBarcode !== false ? lineCodeDisplay(ln, "barcode") : ""
        );
      }
      if (skuCol != null) {
        setCell(ws, row, skuCol, exp.showSku !== false ? ln.sku : "");
      }
    }

    if (variant === "412") {
      setCell(ws, row, 3, blockLabel(ln));
      setCell(ws, row, 4, ln.qty > 0 ? ln.qty : "");
      setCell(ws, row, 5, ln.sum > 0 ? ln.sum : "");
    } else if (variant === "411") {
      setCell(ws, row, 3, ln.price > 0 ? ln.price : "");
      setCell(ws, row, 4, ln.qty > 0 ? ln.qty : "");
      setCell(ws, row, 5, ln.qty > 0 ? ln.qty : "");
      setCell(ws, row, 6, ln.sum > 0 ? ln.sum : "");
    } else {
      setCell(ws, row, 3, blockLabel(ln));
      setCell(ws, row, 4, ln.qty > 0 ? ln.qty : "");
      setCell(ws, row, 5, ln.qty > 0 ? ln.qty : "");
      setCell(ws, row, 6, ln.qty > 0 ? ln.qty : "");
      setCell(ws, row, 7, ln.sum > 0 ? ln.sum : "");
    }
  }

  // Kategoriya «Итого» qatorlari
  for (let row = 5; row <= ws.rowCount; row++) {
    const c2 = cellStr(ws.getCell(row, 2).value);
    if (!/^итого$/i.test(c2)) continue;
    let cat = "";
    for (let up = row - 1; up >= 5; up--) {
      if (isCategoryRow(ws, up)) {
        cat = cellStr(ws.getCell(up, 2).value);
        break;
      }
    }
    const groupLines = ctx.linesByGroup.get(cat) ?? [];
    const t = sumLines(groupLines);
    if (variant === "412") {
      const blk = groupLines[0] ? blockLabel({ ...groupLines[0], qty: t.qty }) : `${t.qty} бл`;
      setCell(ws, row, 3, blk);
      setCell(ws, row, 5, t.sum > 0 ? t.sum : "");
    } else if (variant === "411") {
      setCell(ws, row, 4, t.qty > 0 ? t.qty : "");
      setCell(ws, row, 5, t.qty > 0 ? t.qty : "");
    } else {
      setCell(ws, row, 4, t.qty > 0 ? t.qty : "");
      setCell(ws, row, 7, t.sum > 0 ? t.sum : "");
    }
  }
}
