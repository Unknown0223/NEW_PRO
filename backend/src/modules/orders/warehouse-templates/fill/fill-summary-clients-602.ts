import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { setCell, fmtRuDateShort, cellStr } from "../warehouse-template-fill.helpers";
import { metaAgents, metaTerritories, metaExpeditors } from "../warehouse-template-shared";

/** 602 — svodnaya: mijoz bloklarini qayta yozish (sarlavha saqlanadi). */
export function fillSummaryClients602(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  setCell(ws, 2, 4, fmtRuDateShort(ctx.now));
  setCell(ws, 3, 4, metaAgents(ctx));
  setCell(ws, 4, 4, metaTerritories(ctx));
  setCell(ws, 5, 4, metaExpeditors(ctx));

  let row = 8;
  let clientIdx = 0;
  for (const cc of ctx.clientColumns) {
    const lines = cc.lines.filter((l) => l.qty > 0 || l.sum > 0);
    if (lines.length === 0) continue;
    clientIdx++;
    setCell(ws, row, 1, clientIdx);
    setCell(ws, row, 2, cc.clientName);
    setCell(ws, row, 6, lines[0]!.name);
    setCell(ws, row, 11, lines[0]!.qty);
    setCell(ws, row, 16, lines[0]!.sum);
    row++;
    for (let i = 1; i < lines.length; i++) {
      const ln = lines[i]!;
      setCell(ws, row, 6, ln.name);
      setCell(ws, row, 11, ln.qty);
      setCell(ws, row, 16, ln.sum);
      row++;
    }
    row++;
  }

  // Agar andoza qatorlari ko‘p bo‘lsa — ortiqchasini tozalash
  for (let r = row; r <= Math.min(ws.rowCount, 250); r++) {
    const client = cellStr(ws.getCell(r, 2).value);
    if (client && !ctx.clientColumns.some((c) => c.clientName === client)) {
      for (let c = 6; c <= 16; c++) ws.getCell(r, c).value = null;
    }
  }
}
