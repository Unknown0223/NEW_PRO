import type ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine } from "../../order-nakladnoy-xlsx.types";
import { lineCodeDisplay } from "../../order-nakladnoy-xlsx.format";
import type { WarehouseAggregateContext } from "../warehouse-template-shared";
import { cellStr, setCell, findHeaderColumn } from "../warehouse-template-fill.helpers";
import {
  clearCellValueOnly,
  cloneCellStyle,
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

function writeGroupRowStyled(
  sheet: ExcelJS.Worksheet,
  row: number,
  cols: ListCols,
  sample: ExcelJS.Row,
  groupName: string,
  qty: number,
  sum: number
) {
  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(row, c);
    cloneCellStyle(sample.getCell(c), cell);
    clearCellValueOnly(cell);
  }
  setCell(sheet, row, cols.name, groupName);
  if (qty > 0) setCell(sheet, row, cols.qty, qty);
  if (sum > 0 && cols.sum) setCell(sheet, row, cols.sum, sum);
  sheet.getCell(row, cols.name).font = { ...sheet.getCell(row, cols.name).font, bold: true };
}

function writeProductRowStyled(
  sheet: ExcelJS.Worksheet,
  row: number,
  cols: ListCols,
  sample: ExcelJS.Row,
  idx: number,
  ln: NakladnoyLine,
  options: NakladnoyBuildOptions
) {
  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(row, c);
    cloneCellStyle(sample.getCell(c), cell);
    clearCellValueOnly(cell);
  }
  setCell(sheet, row, cols.no, idx);
  if (cols.code != null) setCell(sheet, row, cols.code, lineCodeDisplay(ln, options.codeColumn));
  setCell(sheet, row, cols.name, ln.name);
  if (ln.qty > 0) setCell(sheet, row, cols.qty, ln.qty);
  if (ln.price > 0) setCell(sheet, row, cols.price, ln.price);
  if (ln.sum > 0) setCell(sheet, row, cols.sum, ln.sum);
}

function writeBonusRowStyled(
  sheet: ExcelJS.Worksheet,
  row: number,
  cols: ListCols,
  sample: ExcelJS.Row,
  idx: number,
  ln: NakladnoyLine
) {
  for (let c = 1; c <= 8; c++) {
    const cell = sheet.getCell(row, c);
    cloneCellStyle(sample.getCell(c), cell);
    clearCellValueOnly(cell);
  }
  setCell(sheet, row, cols.no, idx);
  setCell(sheet, row, cols.name, ln.name);
  if (ln.bonusQty > 0) setCell(sheet, row, cols.qty, ln.bonusQty);
  if (ln.price > 0) setCell(sheet, row, cols.price, ln.price);
}

export function fillExpeditorLoading518(
  wb: ExcelJS.Workbook,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions,
  versionLabel: string
) {
  const sheet = wb.worksheets[0]!;
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

  const groupSample = sheet.getRow(groupSampleRow);
  const productSample = sheet.getRow(productSampleRow);

  const bonusRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("бонус"), headerRow, 120);
  const totalRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("общая сумма"), headerRow, 120);

  const dataStart = headerRow + 1;
  const dataEnd = bonusRow > 0 ? bonusRow - 1 : totalRow > 0 ? totalRow - 1 : sheet.rowCount;

  for (let r = dataStart; r <= dataEnd; r++) {
    for (let c = 1; c <= 8; c++) clearCellValueOnly(sheet.getCell(r, c));
  }

  let row = dataStart;
  let idx = 1;
  let grandQty = 0;
  let grandSum = 0;

  for (const gk of [...ctx.linesByGroup.keys()].sort((a, b) => a.localeCompare(b, "ru"))) {
    const groupLines = ctx.linesByGroup.get(gk)!.filter((ln) => ln.qty > 0);
    if (groupLines.length === 0) continue;

    let gQty = 0;
    let gSum = 0;
    for (const ln of groupLines) {
      gQty += ln.qty;
      gSum += ln.sum;
    }
    writeGroupRowStyled(sheet, row, cols, groupSample, gk, gQty, gSum);
    row++;

    for (const ln of groupLines) {
      writeProductRowStyled(sheet, row, cols, productSample, idx++, ln, options);
      grandQty += ln.qty;
      grandSum += ln.sum;
      row++;
    }
  }

  if (totalRow > 0) {
    setCell(sheet, totalRow, cols.qty, grandQty);
    if (grandSum > 0) setCell(sheet, totalRow, cols.sum, grandSum);
  }

  const bonusLines = ctx.lines.filter((ln) => ln.bonusQty > 0);
  if (bonusRow > 0) {
    if (bonusLines.length === 0) {
      for (let r = bonusRow; r <= (totalRow > bonusRow ? totalRow : bonusRow + 5); r++) {
        sheet.getRow(r).hidden = true;
      }
    } else {
      let br = bonusRow + 1;
      let bi = 1;
      const bonusEnd = totalRow > bonusRow ? totalRow - 1 : br + 20;
      for (; br <= bonusEnd; br++) {
        for (let c = 1; c <= 8; c++) clearCellValueOnly(sheet.getCell(br, c));
      }
      br = bonusRow + 1;
      for (const ln of bonusLines) {
        if (br >= bonusEnd) break;
        writeBonusRowStyled(sheet, br, cols, productSample, bi++, ln);
        br++;
      }
      const bonusQtyTotal = bonusLines.reduce((a, ln) => a + ln.bonusQty, 0);
      setCell(sheet, bonusRow, cols.qty, bonusQtyTotal > 0 ? bonusQtyTotal : "");
    }
  }

  const returnRow = findRowWith(sheet, (r) => rowText(sheet, r).includes("возврат"), headerRow, 150);
  if (returnRow > 0) {
    for (let r = returnRow; r <= sheet.rowCount; r++) sheet.getRow(r).hidden = true;
  }
}
