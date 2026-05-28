/**
 * 5.1.x matritsa — mahsulotlar qatorlarda, agentlar ustunlarda (1, 2, 3…).
 * 516 andoza: №/Код/Продукты/Цена/Кг + yashil agent ustunlari, guruh #CCCCFF, qator #00CCFF.
 */
import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions } from "../../order-nakladnoy-xlsx.types";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import {
  cellStr,
  setCell,
  findHeaderColumn,
  clearCellValueMerged
} from "../warehouse-template-fill.helpers";
import {
  agentMatchesHeader,
  fillArgb,
  fillExpeditorMetaBlock,
  findProductRow,
  findRowWith,
  isGroupTint,
  pickExpeditorDataSheet,
  rowText
} from "../expeditor-loading-fill-shared";

type MatrixLayout = {
  headerRow: number;
  dataStart: number;
  noCol: number;
  codeCol: number | null;
  nameCols: number[];
  priceCol: number;
  totalCol: number;
  agentCols: Array<{ col: number; label: string }>;
  agentLabelRow: number;
};

function isSubgroupTint(argb: string | null): boolean {
  if (!argb) return false;
  const u = argb.toUpperCase();
  return u.endsWith("00CCFF") || u.endsWith("CCFFFF");
}

function findAgentLabelRow(sheet: ExcelJS.Worksheet, headerRow: number): number {
  let bestRow = 1;
  let best = 0;
  for (let r = 1; r < headerRow; r++) {
    let n = 0;
    for (let c = 6; c <= Math.min(sheet.columnCount, 50); c++) {
      const t = cellStr(sheet.getCell(r, c).value);
      if (t.length > 2 && !/^\d+$/.test(t) && !t.toLowerCase().includes("дата")) n++;
    }
    if (n > best) {
      best = n;
      bestRow = r;
    }
  }
  return bestRow;
}

function detectMatrixLayout(sheet: ExcelJS.Worksheet): MatrixLayout | null {
  const headerRow = findRowWith(
    sheet,
    (r) => {
      const t = rowText(sheet, r, 25);
      return t.includes("продукт") && (t.includes("кг") || t.includes("общее") || t.includes("цена"));
    },
    1,
    25
  );
  if (headerRow < 0) return null;

  const nameCol =
    findHeaderColumn(sheet, headerRow, "продукт") ?? findHeaderColumn(sheet, headerRow, "наимен");
  if (!nameCol) return null;

  const nameCols = [nameCol];
  const alt = nameCol === 3 ? 4 : nameCol === 4 ? 3 : null;
  if (alt && cellStr(sheet.getCell(headerRow, alt).value).toLowerCase().includes("продукт")) {
    nameCols.push(alt);
  }

  const totalCol =
    findHeaderColumn(sheet, headerRow, "кг") ??
    findHeaderColumn(sheet, headerRow, "общее") ??
    findHeaderColumn(sheet, headerRow, "колич");
  if (!totalCol) return null;

  const priceCol = findHeaderColumn(sheet, headerRow, "цен") ?? totalCol - 1;
  const noCol = findHeaderColumn(sheet, headerRow, "№") ?? 1;
  const codeCol =
    findHeaderColumn(sheet, headerRow, "код") ?? findHeaderColumn(sheet, headerRow, "штрих");

  const agentLabelRow = findAgentLabelRow(sheet, headerRow);
  const agentCols: Array<{ col: number; label: string }> = [];
  for (let c = 1; c <= Math.min(sheet.columnCount, 60); c++) {
    if (c <= totalCol) continue;
    const h = cellStr(sheet.getCell(headerRow, c).value).toLowerCase();
    if (!/^\d+$/.test(h)) continue;
    const label = cellStr(sheet.getCell(agentLabelRow, c).value);
    if (label) agentCols.push({ col: c, label });
  }

  return {
    headerRow,
    dataStart: headerRow + 1,
    noCol,
    codeCol,
    nameCols,
    priceCol,
    totalCol,
    agentCols,
    agentLabelRow
  };
}

function rowFillArgb(sheet: ExcelJS.Worksheet, r: number, fromCol: number, toCol: number): string | null {
  for (let c = fromCol; c <= toCol; c++) {
    const fg = fillArgb(sheet.getCell(r, c));
    if (fg) return fg;
  }
  return null;
}

function rowKind(
  sheet: ExcelJS.Worksheet,
  r: number,
  layout: MatrixLayout
): "group" | "subgroup" | "product" | "other" {
  const no = cellStr(sheet.getCell(r, layout.noCol).value);
  if (/^\d+$/.test(no)) return "product";

  const nameCol = layout.nameCols[0]!;
  const fg = rowFillArgb(sheet, r, nameCol, layout.totalCol + 6);
  if (isGroupTint(fg)) return "group";
  if (isSubgroupTint(fg)) return "subgroup";

  const name = cellStr(sheet.getCell(r, nameCol).value);
  if (name && r > layout.dataStart) {
    const prev = rowKind(sheet, r - 1, layout);
    if (prev === "group" || prev === "subgroup") return "subgroup";
  }
  return "other";
}

function sumAgentCols(sheet: ExcelJS.Worksheet, r: number, layout: MatrixLayout): number {
  let sum = 0;
  const maxCol = Math.min(
    sheet.columnCount,
    layout.agentCols.length > 0
      ? Math.max(...layout.agentCols.map((a) => a.col))
      : layout.totalCol + 40
  );
  for (let c = layout.totalCol + 1; c <= maxCol; c++) {
    const hdr = cellStr(sheet.getCell(layout.headerRow, c).value);
    if (hdr && !/^\d+$/.test(hdr)) continue;
    const v = Number(cellStr(sheet.getCell(r, c).value).replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(v)) sum += v;
  }
  return sum;
}

function productQtyTotal(sheet: ExcelJS.Worksheet, r: number, layout: MatrixLayout): number {
  const fromCell = Number(cellStr(sheet.getCell(r, layout.totalCol).value).replace(/\s/g, ""));
  if (Number.isFinite(fromCell) && fromCell > 0) return fromCell;
  return sumAgentCols(sheet, r, layout);
}

function syncProductKgRow(sheet: ExcelJS.Worksheet, r: number, layout: MatrixLayout) {
  const sum = sumAgentCols(sheet, r, layout);
  setCell(sheet, r, layout.totalCol, sum > 0 ? sum : null);
}

function recalculateMatrixTotals(sheet: ExcelJS.Worksheet, layout: MatrixLayout) {
  const { dataStart, totalCol } = layout;
  let r = dataStart;
  while (r <= sheet.rowCount) {
    const kind = rowKind(sheet, r, layout);
    if (kind === "product") {
      syncProductKgRow(sheet, r, layout);
      r++;
      continue;
    }
    if (kind === "group") {
      let blockSum = 0;
      let rr = r + 1;
      while (rr <= sheet.rowCount) {
        const k2 = rowKind(sheet, rr, layout);
        if (k2 === "group") break;
        if (k2 === "subgroup") {
          let subSum = 0;
          let rrr = rr + 1;
          while (rrr <= sheet.rowCount) {
            const k3 = rowKind(sheet, rrr, layout);
            if (k3 === "group" || k3 === "subgroup") break;
            if (k3 === "product") {
              syncProductKgRow(sheet, rrr, layout);
              const t = productQtyTotal(sheet, rrr, layout);
              if (t > 0) {
                subSum += t;
                blockSum += t;
              }
            }
            rrr++;
          }
          setCell(sheet, rr, totalCol, subSum > 0 ? subSum : null);
          rr = rrr;
          continue;
        }
        if (k2 === "product") {
          syncProductKgRow(sheet, rr, layout);
          const t = productQtyTotal(sheet, rr, layout);
          if (t > 0) blockSum += t;
        }
        rr++;
      }
      setCell(sheet, r, totalCol, blockSum > 0 ? blockSum : null);
      r = rr;
      continue;
    }
    if (kind === "subgroup") {
      let blockSum = 0;
      let rr = r + 1;
      while (rr <= sheet.rowCount) {
        const k2 = rowKind(sheet, rr, layout);
        if (k2 === "group" || k2 === "subgroup") break;
        if (k2 === "product") {
          syncProductKgRow(sheet, rr, layout);
          const t = productQtyTotal(sheet, rr, layout);
          if (t > 0) blockSum += t;
        }
        rr++;
      }
      setCell(sheet, r, totalCol, blockSum > 0 ? blockSum : null);
      r = rr;
      continue;
    }
    r++;
  }
}

export function fillExpeditorLoadingMatrixAgentsSheet(
  sheet: ExcelJS.Worksheet,
  ctx: WarehouseAggregateContext,
  versionLabel: string
) {
  fillExpeditorMetaBlock(sheet, ctx, versionLabel);

  const layout = detectMatrixLayout(sheet);
  if (!layout) return;

  const { dataStart, agentCols, agentLabelRow, totalCol, nameCols } = layout;

  const maxAgentCol = Math.min(
    sheet.columnCount,
    agentCols.length > 0 ? Math.max(...agentCols.map((a) => a.col)) : totalCol + 40
  );

  for (let r = dataStart; r <= sheet.rowCount; r++) {
    const kind = rowKind(sheet, r, layout);
    if (kind === "group") {
      for (let c = totalCol + 1; c <= maxAgentCol; c++) {
        clearCellValueMerged(sheet, r, c);
      }
      continue;
    }
    if (kind === "subgroup") {
      for (let c = totalCol; c <= maxAgentCol; c++) {
        clearCellValueMerged(sheet, r, c);
      }
      continue;
    }
    if (kind !== "product") continue;
    for (let c = totalCol; c <= maxAgentCol; c++) {
      clearCellValueMerged(sheet, r, c);
    }
  }

  for (const order of ctx.orders) {
    let agentCol: number | null = null;
    for (const ac of agentCols) {
      const hdr = cellStr(sheet.getCell(agentLabelRow, ac.col).value) || ac.label;
      if (agentMatchesHeader(order.agentLine, hdr)) {
        agentCol = ac.col;
        break;
      }
    }
    if (agentCol == null) continue;

    for (const ln of order.lines) {
      if (ln.qty <= 0 && ln.bonusQty <= 0) continue;
      const pr = findProductRow(sheet, ln.name, dataStart, nameCols);
      if (pr < 0) continue;
      const cur = cellStr(sheet.getCell(pr, agentCol).value);
      const curN = cur ? Number(cur.replace(/\s/g, "")) : 0;
      const add = ln.qty > 0 ? ln.qty : ln.bonusQty;
      setCell(sheet, pr, agentCol, curN + add);
    }
  }

  recalculateMatrixTotals(sheet, layout);
}

export function fillExpeditorLoadingMatrixAgents(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  _options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = pickExpeditorDataSheet(wb, versionLabel);
  fillExpeditorLoadingMatrixAgentsSheet(sheet, ctx, versionLabel);
}
