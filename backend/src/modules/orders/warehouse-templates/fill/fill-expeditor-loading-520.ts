import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine } from "../../order-nakladnoy-xlsx.types";
import {
  fmtDate,
  fmtDateTime,
  fmtMoneyInt,
  lineCodeDisplay,
  uniqJoin
} from "../../order-nakladnoy-xlsx.format";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell } from "../warehouse-template-fill.helpers";
import { rebuildExpeditor520Merges } from "../rebuild-expeditor-520-merges";
import {
  clearRowValuesExceptFormulas,
  clearWorksheetMerges,
  removeMergesTouchingRows
} from "../worksheet-merge-utils";

const COL = {
  num: 1,
  code: 2,
  product: 4,
  qty: 5,
  bonus: 6,
  price: 7,
  sum: 8
} as const;

function findRowWith(
  sheet: ExcelJS.Worksheet,
  pred: (r: number) => boolean,
  from = 1,
  to?: number
): number {
  const end = to ?? sheet.rowCount;
  for (let r = from; r <= end; r++) {
    if (pred(r)) return r;
  }
  return -1;
}

function rowText(sheet: ExcelJS.Worksheet, r: number): string {
  const parts: string[] = [];
  for (let c = 1; c <= 8; c++) {
    const t = cellStr(sheet.getCell(r, c).value);
    if (t) parts.push(t);
  }
  return parts.join(" ").toLowerCase();
}

function metaAgentPhones(ctx: WarehouseAggregateContext): string {
  const phones = ctx.orders
    .map((o) => {
      const m = /(\+?\d[\d\s\-()]{8,})/.exec(o.agentLine);
      return m?.[1]?.trim() ?? "";
    })
    .filter(Boolean);
  return uniqJoin([...new Set(phones)]);
}

function dashToNull(v: string): string | null {
  const t = v.trim();
  return !t || t === "—" ? null : t;
}

function copyCellStyle(
  sheet: ExcelJS.Worksheet,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number
) {
  const src = sheet.getCell(fromR, fromC);
  const dst = sheet.getCell(toR, toC);
  dst.style = { ...src.style };
  if (src.numFmt) dst.numFmt = src.numFmt;
}

function copyRowStyles(
  sheet: ExcelJS.Worksheet,
  fromRow: number,
  toRow: number,
  cols = [1, 2, 3, 4, 5, 6, 7, 8]
) {
  const h = sheet.getRow(fromRow).height;
  if (h) sheet.getRow(toRow).height = h;
  for (const c of cols) {
    copyCellStyle(sheet, fromRow, c, toRow, c);
  }
}

function clearRowValues(sheet: ExcelJS.Worksheet, r: number) {
  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(r, c);
    if (!cell.formula) cell.value = null;
  }
}

function mergeCodeCols(sheet: ExcelJS.Worksheet, row: number) {
  try {
    sheet.mergeCells(row, COL.code, row, 3);
  } catch {
    /* */
  }
}

function countDataRows(ctx: WarehouseAggregateContext): number {
  let n = 0;
  for (const gk of ctx.linesByGroup.keys()) {
    const groupLines = ctx.linesByGroup
      .get(gk)!
      .filter((ln) => ln.qty > 0 || ln.bonusQty > 0);
    if (groupLines.length === 0) continue;
    n += 1 + groupLines.length;
  }
  return n;
}

function writeGroupRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  sampleGroupRow: number,
  groupName: string,
  qty: number,
  bonus: number,
  sum: number
) {
  copyRowStyles(sheet, sampleGroupRow, row);
  clearRowValues(sheet, row);
  mergeCodeCols(sheet, row);

  setCell(sheet, row, COL.product, groupName);
  setCell(sheet, row, COL.qty, qty > 0 ? qty : "");
  setCell(sheet, row, COL.bonus, bonus > 0 ? bonus : "");
  setCell(sheet, row, COL.price, "");
  setCell(sheet, row, COL.sum, sum > 0 ? fmtMoneyInt(sum) : "");

  sheet.getCell(row, COL.product).font = { bold: true };
  sheet.getCell(row, COL.product).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  for (const c of [COL.qty, COL.bonus, COL.sum]) {
    sheet.getCell(row, c).font = { bold: true };
    sheet.getCell(row, c).alignment = { horizontal: "right", vertical: "middle" };
  }
}

function writeProductRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  sampleProductRow: number,
  idx: number,
  ln: NakladnoyLine,
  options: NakladnoyBuildOptions
) {
  copyRowStyles(sheet, sampleProductRow, row);
  clearRowValues(sheet, row);
  mergeCodeCols(sheet, row);

  setCell(sheet, row, COL.num, idx);
  setCell(sheet, row, COL.code, lineCodeDisplay(ln, options.codeColumn));
  setCell(sheet, row, COL.product, ln.name);
  setCell(sheet, row, COL.qty, ln.qty > 0 ? ln.qty : "");
  setCell(sheet, row, COL.bonus, ln.bonusQty > 0 ? ln.bonusQty : "");
  setCell(sheet, row, COL.price, ln.price > 0 ? fmtMoneyInt(ln.price) : "");
  setCell(sheet, row, COL.sum, ln.sum > 0 ? fmtMoneyInt(ln.sum) : "");

  sheet.getCell(row, COL.num).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(row, COL.code).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  sheet.getCell(row, COL.product).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  for (const c of [COL.qty, COL.bonus, COL.price, COL.sum]) {
    sheet.getCell(row, c).alignment = { horizontal: "right", vertical: "middle" };
  }
}

export function fillExpeditorLoading520(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = wb.worksheets[0]!;
  const merged = ctx.merged;

  try {
    sheet.mergeCells(1, 1, 1, 8);
  } catch {
    /* */
  }
  const title = sheet.getCell(1, 1);
  title.value = `Загрузочный лист ${versionLabel} (Время печати: ${fmtDateTime(ctx.now)})`;
  title.font = { ...(title.font ?? {}), bold: true };
  title.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  setCell(sheet, 2, 4, fmtDate(merged.createdAt));
  setCell(sheet, 3, 4, merged.dateTo ? fmtDate(merged.dateTo) : null);

  const agents = ctx.agentLabels.join(", ") || merged.agentLine;
  setCell(sheet, 4, 4, dashToNull(agents));
  setCell(sheet, 4, 6, dashToNull(metaAgentPhones(ctx)));

  const territory = ctx.territoryLabels.join(", ") || merged.territory || "";
  setCell(sheet, 5, 4, dashToNull(territory));

  const exp = ctx.expeditorLabels.join(", ") || merged.expeditorLine;
  const expVal = dashToNull(exp);
  if (expVal) {
    sheet.getRow(6).hidden = false;
    setCell(sheet, 6, 4, expVal);
  } else {
    setCell(sheet, 6, 4, null);
    sheet.getRow(6).hidden = true;
  }

  setCell(sheet, 7, 4, merged.currencyLabel || "So'm (UZS)");

  const headerRow = findRowWith(
    sheet,
    (r) => rowText(sheet, r).includes("кол") && rowText(sheet, r).includes("бонус"),
    1,
    20
  );
  const totalRow = findRowWith(
    sheet,
    (r) => rowText(sheet, r).includes("итого"),
    headerRow > 0 ? headerRow : 8,
    sheet.rowCount
  );

  if (headerRow < 0 || totalRow < 0) {
    throw new Error("EXPEDITOR_520_TEMPLATE_LAYOUT_NOT_FOUND");
  }

  const dataStart = headerRow + 1;
  const sampleGroupRow = dataStart;
  const sampleProductRow = dataStart + 1;
  let totalRowAnchor = totalRow;
  const templateDataRows = totalRowAnchor - dataStart;
  const neededDataRows = countDataRows(ctx);
  const rowDelta = neededDataRows - templateDataRows;

  if (rowDelta > 0) {
    const inserts = Array.from({ length: rowDelta }, () => []);
    sheet.spliceRows(totalRowAnchor, 0, ...inserts);
    totalRowAnchor += rowDelta;
  } else if (rowDelta < 0) {
    sheet.spliceRows(dataStart + neededDataRows, -rowDelta);
    totalRowAnchor += rowDelta;
  }
  clearWorksheetMerges(sheet);

  const totalRowFinal = findRowWith(
    sheet,
    (r) => rowText(sheet, r).includes("итого"),
    dataStart,
    sheet.rowCount
  );

  for (let r = dataStart; r < totalRowFinal; r++) {
    clearRowValues(sheet, r);
  }

  const groupKeys = [...ctx.linesByGroup.keys()].sort((a, b) => a.localeCompare(b, "ru"));
  let row = dataStart;
  let idx = 1;
  let grandQty = 0;
  let grandBonus = 0;
  let grandSum = 0;

  for (const gk of groupKeys) {
    const groupLines = ctx.linesByGroup
      .get(gk)!
      .filter((ln) => ln.qty > 0 || ln.bonusQty > 0);
    if (groupLines.length === 0) continue;

    let gQty = 0;
    let gBonus = 0;
    let gSum = 0;
    for (const ln of groupLines) {
      gQty += ln.qty;
      gBonus += ln.bonusQty;
      gSum += ln.sum;
    }

    writeGroupRow(sheet, row, sampleGroupRow, gk, gQty, gBonus, gSum);
    row++;

    for (const ln of groupLines) {
      writeProductRow(sheet, row, sampleProductRow, idx++, ln, options);
      grandQty += ln.qty;
      grandBonus += ln.bonusQty;
      grandSum += ln.sum;
      row++;
    }
  }

  for (let r = row; r < totalRowFinal; r++) {
    clearRowValues(sheet, r);
  }

  removeMergesTouchingRows(sheet, totalRowFinal, totalRowFinal);
  clearRowValuesExceptFormulas(sheet, totalRowFinal);

  setCell(sheet, totalRowFinal, 1, "Итого");
  sheet.getCell(totalRowFinal, 1).font = { bold: true };
  setCell(sheet, totalRowFinal, COL.qty, grandQty);
  setCell(sheet, totalRowFinal, COL.bonus, grandBonus);
  setCell(sheet, totalRowFinal, COL.price, grandSum > 0 ? fmtMoneyInt(grandSum) : "");
  setCell(sheet, totalRowFinal, COL.sum, "");

  for (const c of [COL.qty, COL.bonus, COL.price] as const) {
    const cell = sheet.getCell(totalRowFinal, c);
    cell.font = { bold: true };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  }

  const isFooterRow = (r: number) => {
    const t = rowText(sheet, r);
    return t.includes("складчик") || t.includes("доставщик") || t.includes("____");
  };

  let footerStart = findRowWith(sheet, isFooterRow, totalRowFinal + 1, sheet.rowCount);
  if (footerStart < 0) footerStart = totalRowFinal + 2;

  if (footerStart > totalRowFinal + 1) {
    sheet.spliceRows(totalRowFinal + 1, footerStart - totalRowFinal - 1);
    footerStart = totalRowFinal + 1;
  }

  let lastFooterRow = footerStart;
  for (let r = footerStart; r <= sheet.rowCount; r++) {
    if (isFooterRow(r)) lastFooterRow = r;
  }
  if (sheet.rowCount > lastFooterRow) {
    sheet.spliceRows(lastFooterRow + 1, sheet.rowCount - lastFooterRow);
  }

  rebuildExpeditor520Merges(sheet, dataStart, totalRowFinal, isFooterRow);
}
