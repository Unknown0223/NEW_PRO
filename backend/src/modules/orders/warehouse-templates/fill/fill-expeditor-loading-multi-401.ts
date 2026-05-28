/**
 * 4.0.1 — har bir ekspeditor uchun alohida varaq.
 */
import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";
import {
  clearCellValueOnly,
  fillExpeditorMetaBlock,
  findProductRow,
  rowText
} from "../expeditor-loading-fill-shared";
import { fillExpeditorLoadingMatrixAgentsSheet } from "./fill-expeditor-loading-matrix-agents";

function sheetLooksLikeAgentMatrix(ws: ExcelJS.Worksheet): boolean {
  for (let r = 1; r <= 15; r++) {
    if (rowText(ws, r, 20).includes("продукт") && rowText(ws, r, 20).includes("общее")) return true;
  }
  return false;
}

export function fillExpeditorLoadingMulti401(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const expName = ctx.expeditorLabels[0] ?? ctx.merged.expeditorLine;
  const expKey = expName.trim().toLowerCase().slice(0, 8);

  for (const ws of wb.worksheets) {
    if (ws.rowCount < 8) continue;
    const sn = (ws.name || "").toLowerCase();
    if (sn.includes("общий")) continue;

    if (sheetLooksLikeAgentMatrix(ws)) {
      const subCtx: WarehouseAggregateContext = {
        ...ctx,
        orders: ctx.orders.filter((o) => {
          const el = o.expeditorLine.toLowerCase();
          return !expKey || el.includes(expKey) || sn.includes(expKey.slice(0, 4));
        })
      };
      if (subCtx.orders.length === 0) continue;
      fillExpeditorLoadingMatrixAgentsSheet(ws, subCtx, versionLabel);
      continue;
    }

    fillExpeditorMetaBlock(ws, ctx, versionLabel);
    const headerRow = 8;
    for (let r = headerRow + 1; r <= ws.rowCount; r++) {
      for (let c = 5; c <= 10; c++) clearCellValueOnly(ws.getCell(r, c));
    }
    for (const order of ctx.orders) {
      for (const ln of order.lines) {
        if (ln.qty <= 0) continue;
        const pr = findProductRow(ws, ln.name, headerRow + 1, [2, 3]);
        if (pr < 0) continue;
        const qtyCol = 5;
        const cur = cellStr(ws.getCell(pr, qtyCol).value);
        const curN = cur ? Number(cur.replace(/\s/g, "")) : 0;
        setCell(ws, pr, qtyCol, curN + ln.qty);
      }
    }
  }
}
