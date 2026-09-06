import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import { repairWorkbookBeforeWrite } from "./warehouse-templates/warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-templates/warehouse-template-zip-patch";
import {
  applyBorderRange,
  expandConsignmentSheetGroups,
  FILL_HEADER_GREY,
  sanitizeSheetName
} from "./order-nakladnoy-xlsx.format";
import {
  consignment217AddressLine,
  consignment217BalanceLine,
  consignment217BonusTitle,
  consignment217ClientLine,
  consignment217DateLine,
  consignment217ExpeditorLine,
  consignment217MoneyWithPay,
  consignment217OrderTitle,
  consignment217PaymentLabel,
  consignment217SheetName
} from "./order-nakladnoy-xlsx.consignment-217";

const MONEY_FMT = "#,##0";

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
}

function writeColHeaders(sheet: ExcelJS.Worksheet, r: number, c0: number, cEnd: number) {
  const hdr = ["№", "Наименование", "Блок", "Кол-во", "Цена", "Сумма"];
  hdr.forEach((h, i) => {
    const cell = sheet.getCell(r, c0 + i);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = FILL_HEADER_GREY;
    cell.alignment = { horizontal: i === 1 ? "left" : "right", vertical: "middle" };
  });
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
  sheet.getCell(r, c0 + 5).value = money;
  for (let i = 0; i < 6; i++) {
    const cell = sheet.getCell(r, c0 + i);
    cell.font = { bold: true };
    cell.alignment = { horizontal: i === 1 ? "left" : "right", vertical: "middle" };
  }
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
  writeFullLine(sheet, r++, c0, cEnd, consignment217AddressLine(order.clientAddress));
  writeFullLine(
    sheet,
    r++,
    c0,
    cEnd,
    `Агент: ${order.invoiceAgentLine || order.agentLine || "—"}`
  );
  writeFullLine(sheet, r++, c0, cEnd, consignment217ExpeditorLine(order.expeditorName));
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
  sheet.getCell(r, c0).value = "Отпустил: _______________";
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

/** «Накладные 2.1.7»: har zakaz — chap/o‘ng 2 nusxa; zakazlar tepadan pastga. */
export async function buildConsignmentWorkbook(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALESDOC";
  const printAt = new Date();

  const groups = expandConsignmentSheetGroups(orders, options);
  const usedSheetNames = new Set<string>();
  const uniqueSheetName = (base: string): string => {
    let name = sanitizeSheetName(base).slice(0, 31);
    if (!name) name = "N2_1_7";
    let candidate = name;
    let n = 2;
    while (usedSheetNames.has(candidate)) {
      const suffix = `_${n++}`;
      candidate = sanitizeSheetName(name.slice(0, Math.max(1, 31 - suffix.length)) + suffix);
    }
    usedSheetNames.add(candidate);
    return candidate;
  };

  const formColW = [2.71, 14.71, 5.21, 5.71, 8.71, 11.21];

  for (const group of groups) {
    if (group.length === 0) continue;
    const baseName = consignment217SheetName(group[0]?.expeditorName);
    const sheet = wb.addWorksheet(uniqueSheetName(baseName), {
      views: [{ showGridLines: true }]
    });

    for (let i = 0; i < 6; i++) {
      sheet.getColumn(i + 1).width = formColW[i]!;
      sheet.getColumn(i + 8).width = formColW[i]!;
    }
    sheet.getColumn(7).width = 2.71;
    sheet.getColumn(14).width = 2.71;
    sheet.properties.defaultRowHeight = 15;

    let row = 1;
    for (const order of group) {
      const endL = writeConsignmentBlock(sheet, row, 1, order, printAt);
      const endR = writeConsignmentBlock(sheet, row, 8, order, printAt);
      row = Math.max(endL, endR) + CONSIGNMENT_STACK_GAP;
    }

    sheet.pageSetup = {
      paperSize: 9,
      orientation: "portrait",
      margins: { left: 0.2362, right: 0.2362, top: 0.2362, bottom: 0.2362, header: 0.5, footer: 0.75 },
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };
  }

  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}
