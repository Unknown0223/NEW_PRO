import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine } from "../../order-nakladnoy-xlsx.types";
import { lineCodeDisplay } from "../../order-nakladnoy-xlsx.format";
import {
  LOADING_520_SHELF_RETURN_GROUP,
  sortLoading520GroupKeys
} from "../../order-nakladnoy-xlsx.consignment-217";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell, findHeaderColumn } from "../warehouse-template-fill.helpers";
import {
  fillArgb,
  fillExpeditorMetaBlock,
  findRowWith,
  isGroupTint,
  rowText
} from "../expeditor-loading-fill-shared";

type ListCols = {
  no: number;
  code: number | null;
  name: number;
  qty: number;
  price: number;
  sum: number;
};

type StyleSnap = {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  border?: Partial<ExcelJS.Borders>;
  alignment?: Partial<ExcelJS.Alignment>;
  numFmt?: string;
};

function detectListCols(sheet: ExcelJS.Worksheet, headerRow: number): ListCols | null {
  const name =
    findHeaderColumn(sheet, headerRow, "продукт") ??
    findHeaderColumn(sheet, headerRow, "наимен");
  const qty =
    findHeaderColumn(sheet, headerRow, "колич") ??
    findHeaderColumn(sheet, headerRow, "кг");
  const price = findHeaderColumn(sheet, headerRow, "цен");
  const sum = findHeaderColumn(sheet, headerRow, "сумм");
  if (!name || !qty) return null;
  return {
    no: findHeaderColumn(sheet, headerRow, "№") ?? 1,
    code: findHeaderColumn(sheet, headerRow, "штрих") ?? findHeaderColumn(sheet, headerRow, "код"),
    name,
    qty,
    price: price ?? qty + 1,
    sum: sum ?? (price ?? qty) + 1
  };
}

function snapCell(cell: ExcelJS.Cell): StyleSnap {
  return {
    font: cell.font ? { ...cell.font } : undefined,
    fill: cell.fill ? { ...cell.fill } : undefined,
    border: cell.border ? { ...cell.border } : undefined,
    alignment: cell.alignment ? { ...cell.alignment } : undefined,
    numFmt: cell.numFmt
  } as StyleSnap;
}

function snapRow(sheet: ExcelJS.Worksheet, row: number, cols = 8): { snaps: StyleSnap[]; height?: number } {
  const snaps: StyleSnap[] = [];
  for (let c = 1; c <= cols; c++) snaps.push(snapCell(sheet.getCell(row, c)));
  return { snaps, height: sheet.getRow(row).height };
}

function paintRow(sheet: ExcelJS.Worksheet, row: number, sample: { snaps: StyleSnap[]; height?: number }) {
  const r = sheet.getRow(row);
  if (sample.height && sample.height > 0) r.height = sample.height;
  r.hidden = false;
  for (let c = 1; c <= sample.snaps.length; c++) {
    const cell = r.getCell(c);
    const snap = sample.snaps[c - 1]!;
    if (snap.font) cell.font = { ...snap.font };
    if (snap.fill) cell.fill = { ...snap.fill };
    if (snap.border) cell.border = { ...snap.border };
    if (snap.alignment) cell.alignment = { ...snap.alignment };
    if (snap.numFmt) cell.numFmt = snap.numFmt;
    if (!cell.formula) cell.value = null;
  }
}

function mergedSpan(sheet: ExcelJS.Worksheet, row: number, col: number): number {
  const master = sheet.getCell(row, col);
  let span = 1;
  for (let c = col + 1; c <= col + 6; c++) {
    const cell = sheet.getCell(row, c);
    if (cell.isMerged && cell.master?.address === master.address) span++;
    else break;
  }
  return span;
}

function mergeHorizontal(sheet: ExcelJS.Worksheet, row: number, col: number, span: number) {
  if (span <= 1) return;
  sheet.mergeCells(row, col, row, col + span - 1);
}

function unmergeFromRow(sheet: ExcelJS.Worksheet, fromRow: number) {
  const merges = [
    ...(((sheet as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges) ?? [])
  ];
  for (const ref of merges) {
    const m = /^[A-Z]+(\d+):/i.exec(ref);
    if (!m || Number(m[1]) < fromRow) continue;
    try {
      sheet.unMergeCells(ref);
    } catch {
      /* allaqachon yechilgan */
    }
  }
}

function clearBody(sheet: ExcelJS.Worksheet, fromRow: number) {
  const last = Math.max(sheet.rowCount, fromRow);
  for (let r = fromRow; r <= last; r++) {
    const row = sheet.getRow(r);
    row.hidden = false;
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      if (!cell.formula) cell.value = null;
    }
  }
}

/** exceljs spliceRows qatorlar sonini qisqartirmaydi — shablon dumi bo‘sh qator bo‘lib qoladi. */
function dropRowsAfter(sheet: ExcelJS.Worksheet, lastRow: number) {
  const rows = (sheet as ExcelJS.Worksheet & { _rows?: unknown[] })._rows;
  if (rows && rows.length > lastRow) rows.length = lastRow;
}

function renameSheet(wb: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, versionLabel: string) {
  const name = `Загруз зав.склада ${versionLabel}`.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31);
  if (!name || sheet.name === name) return;
  if (wb.worksheets.some((ws) => ws !== sheet && ws.name === name)) return;
  sheet.name = name;
}

function writeGroup(
  sheet: ExcelJS.Worksheet,
  row: number,
  cols: ListCols,
  sample: { snaps: StyleSnap[]; height?: number },
  nameSpan: number,
  groupName: string,
  qty: number,
  sum: number
) {
  paintRow(sheet, row, sample);
  mergeHorizontal(sheet, row, cols.name, nameSpan);
  setCell(sheet, row, cols.name, groupName);
  if (qty > 0) setCell(sheet, row, cols.qty, qty);
  if (sum > 0) setCell(sheet, row, cols.sum, sum);
  const nameCell = sheet.getCell(row, cols.name);
  nameCell.font = { ...nameCell.font, bold: true };
}

function writeProduct(
  sheet: ExcelJS.Worksheet,
  row: number,
  cols: ListCols,
  sample: { snaps: StyleSnap[]; height?: number },
  nameSpan: number,
  idx: number,
  ln: NakladnoyLine,
  options: NakladnoyBuildOptions,
  mode: "sale" | "bonus"
) {
  paintRow(sheet, row, sample);
  mergeHorizontal(sheet, row, cols.name, nameSpan);
  setCell(sheet, row, cols.no, idx);
  if (mode === "sale" && cols.code != null) {
    setCell(sheet, row, cols.code, lineCodeDisplay(ln, options.codeColumn));
  }
  setCell(sheet, row, cols.name, ln.name);
  const qty = mode === "bonus" ? ln.bonusQty : ln.qty;
  if (qty > 0) setCell(sheet, row, cols.qty, qty);
  if (mode === "sale" && ln.price > 0) setCell(sheet, row, cols.price, ln.price);
  if (mode === "sale" && ln.sum > 0) setCell(sheet, row, cols.sum, ln.sum);
}

function writeTotals(
  sheet: ExcelJS.Worksheet,
  row: number,
  cols: ListCols,
  totalSample: { snaps: StyleSnap[]; height?: number },
  weightSample: { snaps: StyleSnap[]; height?: number },
  nameEndCol: number,
  qty: number,
  sum: number
) {
  paintRow(sheet, row, totalSample);
  paintRow(sheet, row + 1, weightSample);
  if (nameEndCol > 1) {
    sheet.mergeCells(row, 1, row, nameEndCol);
    sheet.mergeCells(row + 1, 1, row + 1, nameEndCol);
  }
  const amountLeft = cols.price > cols.qty ? Math.min(cols.price, cols.sum) : cols.sum;
  const amountRight = Math.max(cols.sum, amountLeft);
  sheet.mergeCells(row, cols.qty, row + 1, cols.qty);
  if (amountLeft !== cols.qty) sheet.mergeCells(row, amountLeft, row + 1, amountRight);
  setCell(sheet, row, 1, "Общая сумма");
  setCell(sheet, row + 1, 1, "Общее(вес)");
  setCell(sheet, row, cols.qty, qty);
  setCell(sheet, row, amountLeft, sum);
}

export function fillExpeditorLoading518(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = wb.worksheets[0]!;
  renameSheet(wb, sheet, versionLabel);
  fillExpeditorMetaBlock(sheet, ctx, versionLabel);

  const headerRow = findRowWith(
    sheet,
    (r) => {
      const t = rowText(sheet, r);
      return t.includes("продукт") && (t.includes("колич") || t.includes("кг") || t.includes("сумм"));
    },
    1,
    30
  );
  if (headerRow < 0) return;

  const cols = detectListCols(sheet, headerRow);
  if (!cols) return;

  let groupSampleRow = -1;
  let productSampleRow = -1;
  for (let r = headerRow + 1; r <= Math.min(sheet.rowCount, headerRow + 50); r++) {
    if (groupSampleRow < 0 && isGroupTint(fillArgb(sheet.getCell(r, cols.name)))) {
      groupSampleRow = r;
    }
    if (productSampleRow < 0 && groupSampleRow > 0 && r > groupSampleRow) {
      const n = cellStr(sheet.getCell(r, cols.no).value);
      if (/^\d+$/.test(n)) productSampleRow = r;
    }
  }
  if (groupSampleRow < 0 || productSampleRow < 0) return;

  const groupSample = snapRow(sheet, groupSampleRow);
  const productSample = snapRow(sheet, productSampleRow);
  const nameSpan = mergedSpan(sheet, headerRow, cols.name);
  const nameEndCol = cols.name + nameSpan - 1;

  const bonusRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("бонус"), headerRow, 120);
  const totalRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("общая сумма"), headerRow, 120);
  const weightRow = findRowWith(
    sheet,
    (r) => rowText(sheet, r).includes("вес"),
    totalRow > 0 ? totalRow : headerRow,
    120
  );
  const returnRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("возврат"), headerRow, 150);

  const bonusSample = snapRow(sheet, bonusRow > 0 ? bonusRow : groupSampleRow);
  const totalSample = snapRow(sheet, totalRow > 0 ? totalRow : groupSampleRow);
  const weightSample = snapRow(sheet, weightRow > 0 ? weightRow : totalRow > 0 ? totalRow : groupSampleRow);
  const returnSample = snapRow(sheet, returnRow > 0 ? returnRow : bonusRow > 0 ? bonusRow : groupSampleRow);

  const dataStart = headerRow + 1;
  unmergeFromRow(sheet, dataStart);
  clearBody(sheet, dataStart);

  const returnKey = LOADING_520_SHELF_RETURN_GROUP;
  const mainKeys = sortLoading520GroupKeys([...ctx.linesByGroup.keys()]).filter((k) => k !== returnKey);

  let row = dataStart;
  let idx = 1;
  let grandQty = 0;
  let grandSum = 0;

  const writeGroups = (keys: string[]) => {
    for (const gk of keys) {
      const groupLines = ctx.linesByGroup.get(gk)!.filter((ln) => ln.qty > 0);
      if (groupLines.length === 0) continue;
      let gQty = 0;
      let gSum = 0;
      for (const ln of groupLines) {
        gQty += ln.qty;
        gSum += ln.sum;
      }
      writeGroup(sheet, row, cols, groupSample, nameSpan, gk, gQty, gSum);
      row++;
      for (const ln of groupLines) {
        writeProduct(sheet, row, cols, productSample, nameSpan, idx++, ln, options, "sale");
        grandQty += ln.qty;
        grandSum += ln.sum;
        row++;
      }
    }
  };

  writeGroups(mainKeys);

  const bonusLines = ctx.lines.filter((ln) => ln.bonusQty > 0);
  paintRow(sheet, row, bonusSample);
  mergeHorizontal(sheet, row, cols.name, nameSpan);
  setCell(sheet, row, cols.name, "Бонусы");
  const bonusQtyTotal = bonusLines.reduce((a, ln) => a + ln.bonusQty, 0);
  if (bonusQtyTotal > 0) setCell(sheet, row, cols.qty, bonusQtyTotal);
  const bonusName = sheet.getCell(row, cols.name);
  bonusName.font = { ...bonusName.font, bold: true };
  row++;
  let bonusIdx = 1;
  for (const ln of bonusLines) {
    writeProduct(sheet, row, cols, productSample, nameSpan, bonusIdx++, ln, options, "bonus");
    row++;
  }

  writeTotals(sheet, row, cols, totalSample, weightSample, nameEndCol, grandQty, grandSum);
  row += 2;

  const returnLines = (ctx.linesByGroup.get(returnKey) ?? []).filter((ln) => ln.qty > 0);
  if (returnLines.length > 0) {
    let rQty = 0;
    let rSum = 0;
    for (const ln of returnLines) {
      rQty += ln.qty;
      rSum += ln.sum;
    }
    writeGroup(sheet, row, cols, returnSample, nameSpan, returnKey, rQty, rSum);
    row++;
    let returnIdx = 1;
    for (const ln of returnLines) {
      writeProduct(sheet, row, cols, productSample, nameSpan, returnIdx++, ln, options, "sale");
      row++;
    }
  }

  dropRowsAfter(sheet, row - 1);
}
