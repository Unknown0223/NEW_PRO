import type ExcelJS from "exceljs";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { lookupLine, metaAgents, metaTerritories, metaExpeditors } from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { cellStr, setCell, fmtRuDateShort } from "../warehouse-template-fill.helpers";

export function fillMatrixAgents600(wb: ExcelJS.Workbook, ctx: WarehouseAggregateContext) {
  const ws = primaryDataSheet(wb);
  setCell(ws, 2, 3, fmtRuDateShort(ctx.now));
  setCell(ws, 3, 3, metaAgents(ctx));
  setCell(ws, 4, 3, metaTerritories(ctx));
  setCell(ws, 5, 3, metaExpeditors(ctx));

  const agentCols: Array<{ col: number; label: string }> = [];
  for (let c = 5; c <= 10; c++) {
    const label = cellStr(ws.getCell(1, c).value) || cellStr(ws.getCell(7, c).value);
    if (label && label !== "Итог" && !/^\d+$/.test(label)) {
      agentCols.push({ col: c, label });
    }
  }

  const agentToCol = new Map<string, number>();
  for (const a of agentCols) agentToCol.set(a.label.toLowerCase(), a.col);

  for (const o of ctx.orders) {
    const agentName = o.agentLine.replace(/^[^[]*\[|\].*$/g, "").trim() || o.agentLine;
    for (const [label, col] of agentToCol) {
      if (agentName.toLowerCase().includes(label.toLowerCase().slice(0, 8))) {
        agentToCol.set(`order:${o.id}`, col);
      }
    }
  }

  for (let row = 8; row <= ws.rowCount; row++) {
    const name = cellStr(ws.getCell(row, 3).value) || cellStr(ws.getCell(row, 2).value);
    if (!name || name === "Продукты" || name === "Общее") continue;
    const ln = lookupLine(ctx, name);
    if (!ln || ln.qty <= 0) continue;

    for (const o of ctx.orders) {
      const ol = o.lines.find((x) => x.productId === ln.productId);
      if (!ol || ol.qty <= 0) continue;
      const agentKey = o.agentLine.toLowerCase();
      for (const { col, label } of agentCols) {
        if (agentKey.includes(label.toLowerCase().slice(0, 6))) {
          const cur = ws.getCell(row, col).value;
          const prev = typeof cur === "number" ? cur : Number(cur) || 0;
          setCell(ws, row, col, prev + ol.qty);
        }
      }
    }
    const totalCol = 4;
    const curT = ws.getCell(row, totalCol).value;
    const prevT = typeof curT === "number" ? curT : Number(curT) || 0;
    if (ln.qty > prevT) setCell(ws, row, totalCol, ln.qty);
    setCell(ws, row, 11, ln.qty);
  }
}
