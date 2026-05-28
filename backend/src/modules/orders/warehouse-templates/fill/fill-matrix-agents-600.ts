import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import {
  lookupLine,
  metaAgents,
  metaTerritories,
  metaExpeditors,
  metaAgentPhones
} from "../warehouse-template-shared";
import { primaryDataSheet } from "../warehouse-template-assets";
import { cellStr, setCell, fmtRuDateShort, findHeaderColumn } from "../warehouse-template-fill.helpers";
import { DEFAULT_WAREHOUSE_EXPORT_OPTIONS } from "../warehouse-export-options";

function clearCell(ws: ExcelJS.Worksheet, row: number, col: number) {
  ws.getCell(row, col).value = null;
}

export function fillMatrixAgents600(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions
) {
  const ws = primaryDataSheet(wb);
  const exp = options.warehouseExport ?? DEFAULT_WAREHOUSE_EXPORT_OPTIONS;

  if (exp.showLoadDate !== false) {
    setCell(ws, 2, 3, fmtRuDateShort(ctx.now));
  } else {
    clearCell(ws, 2, 3);
  }
  if (exp.showAgents !== false) {
    setCell(ws, 3, 3, metaAgents(ctx));
  } else {
    clearCell(ws, 3, 3);
  }
  if (exp.showTerritory !== false) {
    setCell(ws, 4, 3, metaTerritories(ctx));
  } else {
    clearCell(ws, 4, 3);
  }
  if (exp.showExpeditor !== false) {
    setCell(ws, 5, 3, metaExpeditors(ctx));
  } else {
    clearCell(ws, 5, 3);
  }
  if (exp.showAgentPhone !== false) {
    setCell(ws, 6, 3, metaAgentPhones(ctx));
  } else {
    clearCell(ws, 6, 3);
  }

  const agentCols: Array<{ col: number; label: string }> = [];
  for (let c = 5; c <= 10; c++) {
    const label = cellStr(ws.getCell(1, c).value) || cellStr(ws.getCell(7, c).value);
    if (label && label !== "Итог" && !/^\d+$/.test(label)) {
      agentCols.push({ col: c, label });
    }
  }

  const idCol = findHeaderColumn(ws, 7, "ид") ?? findHeaderColumn(ws, 1, "ид");
  const codeCol = findHeaderColumn(ws, 7, "код") ?? findHeaderColumn(ws, 1, "код");
  const priceCol = findHeaderColumn(ws, 7, "цен") ?? findHeaderColumn(ws, 1, "цен");

  for (let row = 8; row <= ws.rowCount; row++) {
    const name = cellStr(ws.getCell(row, 3).value) || cellStr(ws.getCell(row, 2).value);
    if (!name || name === "Продукты" || name === "Общее") continue;
    const ln = lookupLine(ctx, name);

    if (exp.productsByOrderOnly !== false) {
      if (!ln || ln.qty <= 0) {
        for (const { col } of agentCols) clearCell(ws, row, col);
        clearCell(ws, row, 4);
        clearCell(ws, row, 11);
        continue;
      }
    } else if (!ln) {
      continue;
    }

    const line = ln!;
    if (idCol != null) {
      setCell(ws, row, idCol, exp.showProductId !== false ? line.productId : "");
    }
    if (codeCol != null) {
      setCell(ws, row, codeCol, exp.showProductCode !== false ? line.sku : "");
    }
    if (priceCol != null) {
      setCell(
        ws,
        row,
        priceCol,
        exp.showProductPrice !== false && line.price > 0 ? Math.round(line.price) : ""
      );
    }

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
