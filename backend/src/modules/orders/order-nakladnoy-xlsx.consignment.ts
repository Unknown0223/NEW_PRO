import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import { repairWorkbookBeforeWrite } from "./warehouse-templates/warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-templates/warehouse-template-zip-patch";
import {
  applyBorderRange,
  blockCount,
  expandConsignmentSheetGroups,
  FILL_HEADER_GREY,
  fmtDate,
  fmtDateTime,
  fmtMoney2,
  fmtMoneyInt,
  lineCodeDisplay,
  sanitizeSheetName,
  sheetNameForGroup
} from "./order-nakladnoy-xlsx.format";

/** «Накладные 2.1.0»: 6 ustun ichida chapda texnik nom, o‘ngda qiymat; sarlavha 2.1.0. */
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
  const labelEnd = c0 + 1;
  const valueStart = c0 + 2;

  const rowLabelValue = (label: string, value: string) => {
    sheet.mergeCells(r, c0, r, labelEnd);
    const lc = sheet.getCell(r, c0);
    lc.value = label;
    lc.font = { bold: true, size: 10 };
    lc.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    sheet.mergeCells(r, valueStart, r, cEnd);
    const vc = sheet.getCell(r, valueStart);
    vc.value = value;
    vc.font = { size: 10 };
    vc.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
    applyBorderRange(sheet, r, c0, r, cEnd);
    r++;
  };

  const bal =
    order.clientBalanceNum != null
      ? `${fmtMoney2(Number(order.clientBalanceNum.toString()))} UZS`
      : "0,00 UZS";
  const tel = order.tenantPhone?.trim() || "—";

  rowLabelValue("Клиент:", order.clientName);
  rowLabelValue("Баланс клиента:", bal);
  rowLabelValue("Адрес:", order.clientAddress || "—");
  rowLabelValue("Агент:", order.agentLine || "—");
  rowLabelValue("Экспедитор:", order.expeditorLine || "—");
  rowLabelValue("Дата накладной / тел:", `${fmtDate(printAt)} / ${tel}`);

  sheet.mergeCells(r, c0, r, cEnd);
  const h1 = sheet.getCell(r, c0);
  h1.value = "2.1.0";
  h1.font = { bold: true, size: 12 };
  h1.alignment = { horizontal: "center", vertical: "middle" };
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;

  sheet.mergeCells(r, c0, r, cEnd);
  const h2 = sheet.getCell(r, c0);
  h2.value = `Заказ (№${order.number})`;
  h2.font = { bold: true, size: 11 };
  h2.alignment = { horizontal: "left", vertical: "middle" };
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;

  const hdr = ["№", "Наименование", "Блок", "Кол-во", "Цена", "Сумма"];
  hdr.forEach((h, i) => {
    const cell = sheet.getCell(r, c0 + i);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = FILL_HEADER_GREY;
    cell.alignment = { horizontal: i === 1 ? "left" : "right", vertical: "middle" };
  });
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;

  let n = 1;
  let tBlock = 0;
  let tQty = 0;
  let tSum = 0;
  for (const ln of order.paidLines) {
    const b = blockCount(ln);
    if (typeof b === "number") tBlock += b;
    sheet.getCell(r, c0).value = n++;
    sheet.getCell(r, c0 + 1).value = ln.name;
    sheet.getCell(r, c0 + 2).value = typeof b === "number" ? b : b;
    sheet.getCell(r, c0 + 3).value = ln.qty;
    sheet.getCell(r, c0 + 4).value = fmtMoneyInt(ln.price);
    sheet.getCell(r, c0 + 5).value = fmtMoneyInt(ln.sum);
    for (let i = 0; i < 6; i++) {
      sheet.getCell(r, c0 + i).alignment = {
        horizontal: i === 1 ? "left" : "right",
        vertical: "middle",
        wrapText: i === 1
      };
    }
    applyBorderRange(sheet, r, c0, r, cEnd);
    tQty += ln.qty;
    tSum += ln.sum;
    r++;
  }

  sheet.getCell(r, c0).value = "";
  sheet.getCell(r, c0 + 1).value = "Итог:";
  sheet.getCell(r, c0 + 2).value = tBlock > 0 ? Math.round(tBlock * 1000) / 1000 : "—";
  sheet.getCell(r, c0 + 3).value = tQty;
  sheet.getCell(r, c0 + 4).value = "";
  sheet.getCell(r, c0 + 5).value = fmtMoneyInt(tSum);
  for (let i = 0; i < 6; i++) {
    const cell = sheet.getCell(r, c0 + i);
    cell.fill = FILL_HEADER_GREY;
    cell.font = { bold: true };
    cell.alignment = {
      horizontal: i === 1 ? "left" : "right",
      vertical: "middle"
    };
  }
  applyBorderRange(sheet, r, c0, r, cEnd);
  r += 2;

  sheet.mergeCells(r, c0, r, cEnd);
  sheet.getCell(r, c0).value = `Бонус(№${order.number})`;
  sheet.getCell(r, c0).font = { bold: true };
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;

  hdr.forEach((h, i) => {
    const cell = sheet.getCell(r, c0 + i);
    cell.value = h;
    cell.font = { bold: true };
    cell.fill = FILL_HEADER_GREY;
    cell.alignment = { horizontal: i === 1 ? "left" : "right", vertical: "middle" };
  });
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;

  let bn = 1;
  let bBlock = 0;
  let bQ = 0;
  for (const ln of order.bonusLines) {
    const b = blockCount(ln);
    if (typeof b === "number") bBlock += b;
    sheet.getCell(r, c0).value = bn++;
    sheet.getCell(r, c0 + 1).value = ln.name;
    sheet.getCell(r, c0 + 2).value = typeof b === "number" ? b : b;
    sheet.getCell(r, c0 + 3).value = ln.qty;
    sheet.getCell(r, c0 + 4).value = "";
    sheet.getCell(r, c0 + 5).value = "";
    for (let i = 0; i < 6; i++) {
      sheet.getCell(r, c0 + i).alignment = {
        horizontal: i === 1 ? "left" : "right",
        vertical: "middle",
        wrapText: i === 1
      };
    }
    applyBorderRange(sheet, r, c0, r, cEnd);
    bQ += ln.qty;
    r++;
  }

  sheet.getCell(r, c0).value = "";
  sheet.getCell(r, c0 + 1).value = "Итог:";
  sheet.getCell(r, c0 + 2).value =
    order.bonusLines.length === 0 ? "—" : bBlock > 0 ? Math.round(bBlock * 1000) / 1000 : "—";
  sheet.getCell(r, c0 + 3).value = bQ;
  sheet.getCell(r, c0 + 4).value = "";
  sheet.getCell(r, c0 + 5).value = "";
  for (let i = 0; i < 6; i++) {
    sheet.getCell(r, c0 + i).fill = FILL_HEADER_GREY;
    sheet.getCell(r, c0 + i).font = { bold: true };
    sheet.getCell(r, c0 + i).alignment = {
      horizontal: i === 1 ? "left" : "right",
      vertical: "middle"
    };
  }
  applyBorderRange(sheet, r, c0, r, cEnd);
  r += 2;

  sheet.mergeCells(r, c0, r, c0 + 2);
  sheet.getCell(r, c0).value = "Отпустил: _______________";
  sheet.mergeCells(r, c0 + 3, r, cEnd);
  sheet.getCell(r, c0 + 3).value = "Принял: _________________";
  sheet.getCell(r, c0).font = { bold: true };
  sheet.getCell(r, c0 + 3).font = { bold: true };
  applyBorderRange(sheet, r, c0, r, cEnd);
  r++;
  return r;
}

const CONSIGNMENT_STACK_GAP = 2;

/** «Накладные 2.1.0»: har zakaz — chap/o‘ng 2 nusxa; zakazlar tepadan pastga. */
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
    if (!name) name = "N2_1_0";
    let candidate = name;
    let n = 2;
    while (usedSheetNames.has(candidate)) {
      const suffix = `_${n++}`;
      candidate = sanitizeSheetName(name.slice(0, Math.max(1, 31 - suffix.length)) + suffix);
    }
    usedSheetNames.add(candidate);
    return candidate;
  };

  /** Jami kenglik ~portrait A4 ga mos (2 forma + tor oraliq). */
  const formColW = [5, 21, 7, 8, 9, 10];

  for (const group of groups) {
    if (group.length === 0) continue;
    const baseName = options.separateSheets
      ? sheetNameForGroup(options.groupBy, group)
      : group.length === 1
        ? `K-${group[0]!.number}`
        : `N210_${group.length}`;
    const sheet = wb.addWorksheet(uniqueSheetName(baseName), {
      views: [{ showGridLines: true }]
    });

    for (let i = 0; i < 6; i++) {
      sheet.getColumn(i + 1).width = formColW[i]!;
      sheet.getColumn(i + 8).width = formColW[i]!;
    }
    sheet.getColumn(7).width = 1.2;
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
      margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
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
