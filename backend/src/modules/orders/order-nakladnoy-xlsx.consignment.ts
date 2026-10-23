import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import { repairWorkbookBeforeWrite } from "./warehouse-templates/warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-templates/warehouse-template-zip-patch";
import { applyBorderRange, FILL_HEADER_GREY } from "./order-nakladnoy-xlsx.format";
import {
  numberedSheetName,
  splitOrdersIntoSheetGroups,
  uniqueSheetName
} from "./warehouse-templates/nakladnoy-sheet-groups";
import {
  consignment217AddressLine,
  consignment217BalanceLine,
  consignment217BonusTitle,
  consignment217ClientLine,
  consignment217CommentLine,
  consignment217DateLine,
  consignment217DiscountLine,
  consignment217LandmarkLine,
  consignment217MoneyWithPay,
  consignment217OrderTitle,
  consignment217PaymentLabel,
  consignment217PersonBlock,
  consignment217SheetName,
  consignment217TerritoryLine
} from "./order-nakladnoy-xlsx.consignment-217";
import {
  nakladnoyPageCapacityPt,
  nakladnoyPrintScalePercent,
  packNakladnoyBlocksIntoPages
} from "./order-nakladnoy-page-pack";

const MONEY_FMT = "#,##0";
const ROW_PT = 15;
/** 6 kolonkali merge (≈337px) da 10pt bold matn — bir qatordagi belgi soni. */
const FULL_LINE_CHARS = 52;
/** «Цена»+«Сумма» merge (≈139px) da 11pt bold summa matni. */
const TOTAL_MONEY_CHARS = 19;
/** «Наименование» kolonkasi (≈103px) da 11pt matn — bir qatordagi belgi soni. */
const PRODUCT_NAME_CHARS = 14;

function wrappedLineCount(value: string, charsPerLine: number): number {
  return value
    .split("\n")
    .reduce((n, part) => n + Math.max(1, Math.ceil(part.trim().length / charsPerLine)), 0);
}

function writeFullLine(
  sheet: ExcelJS.Worksheet,
  r: number,
  c0: number,
  cEnd: number,
  value: string,
  opts?: { bold?: boolean; size?: number; align?: ExcelJS.Alignment["horizontal"] }
) {
  sheet.mergeCells(r, c0, r, cEnd);
  const cell = sheet.getCell(r, c0);
  cell.value = value;
  cell.font = { bold: opts?.bold ?? true, size: opts?.size ?? 10 };
  cell.alignment = {
    vertical: "middle",
    horizontal: opts?.align ?? "left",
    wrapText: true
  };
  applyBorderRange(sheet, r, c0, r, cEnd);
  const lineCount = Math.min(4, wrappedLineCount(value, FULL_LINE_CHARS));
  sheet.getRow(r).height = Math.max(ROW_PT, 14 * lineCount + 2);
}

/** Bo‘sh/null qatorlarni o‘tkazib yuboradi (nakladnoyda faqat bor maydonlar). */
function writeOptionalFullLine(
  sheet: ExcelJS.Worksheet,
  r: number,
  c0: number,
  cEnd: number,
  value: string | null | undefined,
  opts?: { bold?: boolean; size?: number; align?: ExcelJS.Alignment["horizontal"] }
): number {
  const t = value?.trim();
  if (!t) return r;
  writeFullLine(sheet, r, c0, cEnd, t, opts);
  return r + 1;
}

function writeColHeaders(sheet: ExcelJS.Worksheet, r: number, c0: number, cEnd: number) {
  const hdr = ["№", "Наименование", "Блок", "Кол-во", "Цена", "Сумма"];
  hdr.forEach((h, i) => {
    const cell = sheet.getCell(r, c0 + i);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.fill = FILL_HEADER_GREY;
    cell.alignment = { horizontal: i === 1 ? "left" : "right", vertical: "middle" };
  });
  sheet.getRow(r).height = ROW_PT;
  applyBorderRange(sheet, r, c0, r, cEnd);
}

function writeProductRow(
  sheet: ExcelJS.Worksheet,
  r: number,
  c0: number,
  cEnd: number,
  n: number,
  ln: NakladnoyLine
) {
  sheet.getCell(r, c0).value = n;
  sheet.getCell(r, c0 + 1).value = ln.name;
  sheet.getCell(r, c0 + 2).value = ln.qty;
  sheet.getCell(r, c0 + 3).value = ln.qty;
  sheet.getCell(r, c0 + 4).value = ln.price;
  sheet.getCell(r, c0 + 4).numFmt = MONEY_FMT;
  sheet.getCell(r, c0 + 5).value = ln.sum;
  sheet.getCell(r, c0 + 5).numFmt = MONEY_FMT;
  for (let i = 0; i < 6; i++) {
    sheet.getCell(r, c0 + i).alignment = {
      horizontal: i === 1 ? "left" : "right",
      vertical: "middle",
      wrapText: i === 1
    };
  }
  sheet.getRow(r).height = ROW_PT * Math.min(4, wrappedLineCount(ln.name ?? "", PRODUCT_NAME_CHARS));
  applyBorderRange(sheet, r, c0, r, cEnd);
}

function writeTotalRow(
  sheet: ExcelJS.Worksheet,
  r: number,
  c0: number,
  cEnd: number,
  label: string,
  block: number,
  qty: number,
  money: string
) {
  sheet.getCell(r, c0 + 1).value = label;
  sheet.getCell(r, c0 + 1).font = { bold: true };
  sheet.getCell(r, c0 + 2).value = block;
  sheet.getCell(r, c0 + 3).value = qty;
  sheet.mergeCells(r, c0 + 4, r, c0 + 5);
  sheet.getCell(r, c0 + 4).value = money;
  for (let i = 0; i < 6; i++) {
    const cell = sheet.getCell(r, c0 + i);
    cell.font = { bold: true };
    cell.alignment = {
      horizontal: i === 1 ? "left" : "right",
      vertical: "middle",
      wrapText: i === 1 || i === 4
    };
  }
  const lines = Math.max(
    wrappedLineCount(label, PRODUCT_NAME_CHARS),
    wrappedLineCount(money, TOTAL_MONEY_CHARS)
  );
  sheet.getRow(r).height = ROW_PT * Math.min(2, lines);
  applyBorderRange(sheet, r, c0, r, cEnd);
}

/** «Накладные 2.1.7»: to‘liq qator sarlavhalar, 2 nusxa, yakunlarda to‘lov yozuvi. */
function writeConsignmentBlock(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startCol: number,
  order: NakladnoyOrderPayload,
  printAt: Date
): number {
  const c0 = startCol;
  let r = startRow;
  const cEnd = startCol + 5;
  const pay = consignment217PaymentLabel(order.paymentMethodRef);
  const cons = order.isConsignment === true;
  const bal =
    order.clientBalanceNum != null ? Number(order.clientBalanceNum.toString()) : 0;

  writeFullLine(sheet, r++, c0, cEnd, consignment217ClientLine(order.clientName, order.clientPhone));
  writeFullLine(sheet, r++, c0, cEnd, consignment217BalanceLine(bal));
  r = writeOptionalFullLine(sheet, r, c0, cEnd, consignment217AddressLine(order.clientAddress));
  r = writeOptionalFullLine(sheet, r, c0, cEnd, consignment217LandmarkLine(order.clientLandmark));
  r = writeOptionalFullLine(
    sheet,
    r,
    c0,
    cEnd,
    consignment217PersonBlock("Агент", order.agentName, order.agentPhone)
  );
  r = writeOptionalFullLine(
    sheet,
    r,
    c0,
    cEnd,
    consignment217PersonBlock("Экспедитор", order.expeditorName, order.expeditorPhone)
  );
  r = writeOptionalFullLine(
    sheet,
    r,
    c0,
    cEnd,
    consignment217TerritoryLine(order.invoiceTerritory || order.territory)
  );
  r = writeOptionalFullLine(sheet, r, c0, cEnd, consignment217DiscountLine(order.discountSum));
  r = writeOptionalFullLine(sheet, r, c0, cEnd, consignment217CommentLine(order.orderComment));
  writeFullLine(sheet, r++, c0, cEnd, consignment217DateLine(printAt));

  writeFullLine(sheet, r++, c0, cEnd, consignment217OrderTitle(order.number, cons), {
    size: 11
  });
  writeColHeaders(sheet, r++, c0, cEnd);

  let n = 1;
  let goodsQty = 0;
  let goodsSum = 0;
  for (const ln of order.paidLines) {
    writeProductRow(sheet, r++, c0, cEnd, n++, ln);
    goodsQty += ln.qty;
    goodsSum += ln.sum;
  }

  writeFullLine(sheet, r++, c0, cEnd, consignment217BonusTitle(order.number, cons), {
    size: 11
  });
  writeColHeaders(sheet, r++, c0, cEnd);

  let bn = 1;
  let bonusQty = 0;
  let bonusSum = 0;
  for (const ln of order.bonusLines) {
    writeProductRow(sheet, r++, c0, cEnd, bn++, ln);
    bonusQty += ln.qty;
    bonusSum += ln.sum;
  }

  writeTotalRow(
    sheet,
    r++,
    c0,
    cEnd,
    "Итог товары:",
    goodsQty,
    goodsQty,
    consignment217MoneyWithPay(goodsSum, pay)
  );
  writeTotalRow(
    sheet,
    r++,
    c0,
    cEnd,
    "Итог бонус товары:",
    bonusQty,
    bonusQty,
    consignment217MoneyWithPay(bonusSum, pay)
  );
  writeTotalRow(
    sheet,
    r++,
    c0,
    cEnd,
    "Общий итог:",
    goodsQty + bonusQty,
    goodsQty + bonusQty,
    consignment217MoneyWithPay(goodsSum, pay)
  );

  sheet.mergeCells(r, c0, r, c0 + 2);
  sheet.getCell(r, c0).value = "Отпустил: ___________";
  sheet.mergeCells(r, c0 + 3, r, cEnd);
  sheet.getCell(r, c0 + 3).value = "Принял: _________________";
  sheet.getCell(r, c0).font = { bold: true };
  sheet.getCell(r, c0 + 3).font = { bold: true };
  sheet.getRow(r).height = 30;
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;
  return r;
}

const CONSIGNMENT_STACK_GAP = 2;
const CONSIGNMENT_MARGIN_IN = 0.2362;

function sumRowHeightsPt(sheet: ExcelJS.Worksheet, fromRow: number, toRowExclusive: number): number {
  let sum = 0;
  for (let r = fromRow; r < toRowExclusive; r++) {
    sum += sheet.getRow(r).height ?? ROW_PT;
  }
  return sum;
}

/** «Накладные 2.1.7»: har zakaz — chap/o‘ng 2 nusxa; zakazlar tepadan pastga. */
export async function buildConsignmentWorkbook(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALESDOC";
  const printAt = new Date();

  const groups = splitOrdersIntoSheetGroups(orders, options);
  const usedSheetNames = new Set<string>();

  const formColW = [2.71, 14.71, 5.21, 5.71, 8.71, 11.21];
  const allColW = [...formColW, 2.71, ...formColW, 2.71];
  const scale = nakladnoyPrintScalePercent(allColW, CONSIGNMENT_MARGIN_IN);
  const capacity = nakladnoyPageCapacityPt(scale, CONSIGNMENT_MARGIN_IN);
  const measureSheet = new ExcelJS.Workbook().addWorksheet("measure");
  let measureRow = 1;

  for (const [gi, sheetGroup] of groups.entries()) {
    const group = sheetGroup.orders;
    if (group.length === 0) continue;
    const baseName = options.separateSheets
      ? numberedSheetName(gi + 1, "217", sheetGroup.label)
      : consignment217SheetName(group[0]?.expeditorName);
    const sheet = wb.addWorksheet(uniqueSheetName(usedSheetNames, baseName), {
      views: [{ showGridLines: true }]
    });

    for (let i = 0; i < allColW.length; i++) {
      sheet.getColumn(i + 1).width = allColW[i]!;
    }
    sheet.properties.defaultRowHeight = ROW_PT;

    const heights = group.map((order) => {
      const from = measureRow;
      measureRow = writeConsignmentBlock(measureSheet, from, 1, order, printAt);
      return sumRowHeightsPt(measureSheet, from, measureRow);
    });
    const pages = packNakladnoyBlocksIntoPages({
      heights,
      capacity,
      gap: CONSIGNMENT_STACK_GAP * ROW_PT
    });

    let row = 1;
    pages.forEach((page, pi) => {
      page.forEach((idx, k) => {
        const order = group[idx]!;
        const endL = writeConsignmentBlock(sheet, row, 1, order, printAt);
        const endR = writeConsignmentBlock(sheet, row, 8, order, printAt);
        row = Math.max(endL, endR);
        if (k < page.length - 1) row += CONSIGNMENT_STACK_GAP;
      });
      if (pi < pages.length - 1) sheet.getRow(row - 1).addPageBreak();
    });

    sheet.pageSetup = {
      paperSize: 9,
      orientation: "portrait",
      margins: {
        left: CONSIGNMENT_MARGIN_IN,
        right: CONSIGNMENT_MARGIN_IN,
        top: CONSIGNMENT_MARGIN_IN,
        bottom: CONSIGNMENT_MARGIN_IN,
        header: 0,
        footer: 0
      },
      scale,
      fitToPage: false
    };
  }

  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}
