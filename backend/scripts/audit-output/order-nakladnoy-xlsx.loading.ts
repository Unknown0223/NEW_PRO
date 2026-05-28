import ExcelJS from "exceljs";
import { repairWorkbookBeforeWrite } from "./warehouse-templates/warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-templates/warehouse-template-zip-patch";
import type { NakladnoyBuildOptions, NakladnoyLine, NakladnoyOrderPayload } from "./order-nakladnoy-xlsx.types";
import {
  applyBorderRange,
  expandLoadingSheetPayloads,
  FILL_GROUP,
  FILL_HEADER_GREY,
  fmtDate,
  fmtDateTime,
  fmtMoneyInt,
  lineCodeDisplay,
  mergeLoadingLines,
  sanitizeSheetName
} from "./order-nakladnoy-xlsx.format";

// ── Raqam formatlari ─────────────────────────────────────────────
const NUM_FMT_INT   = '# ##0';
const NUM_FMT_MONEY = '# ##0';

function addLoadingSheetWorksheet(
  wb: ExcelJS.Workbook,
  order: NakladnoyOrderPayload,
  options: NakladnoyBuildOptions
) {
  const sheet = wb.addWorksheet(sanitizeSheetName(order.number), {
    views: [{ showGridLines: true }]
  });
  const wCode = options.codeColumn === "barcode" ? 12 : 10;
  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = wCode;
  sheet.getColumn(3).width = wCode;
  sheet.getColumn(4).width = 46;
  sheet.getColumn(5).width = 11;
  sheet.getColumn(6).width = 11;
  sheet.getColumn(7).width = 13;
  sheet.getColumn(8).width = 15;
  sheet.properties.defaultRowHeight = 18;

  const mergedLines = mergeLoadingLines(order.lines);

  let row = 1;
  sheet.mergeCells(row, 1, row, 8);
  const t = sheet.getCell(row, 1);
  t.value = `Загруз зав.склада 5.1.8 (Время печати: ${fmtDateTime(new Date())})`;
  t.font = { bold: true, size: 12 };
  t.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  applyBorderRange(sheet, row, 1, row, 8);
  row++;

  const dateShip = order.dateTo ? fmtDate(order.dateTo) : "—";
  const meta: [string, string][] = [
    ["Дата заявки", fmtDate(order.createdAt)],
    ["Дата отгрузки", dateShip],
    ["Агенты", order.agentLine],
    ["Территория", order.territory || "—"],
    ["Экспедитор", order.expeditorLine],
    ["Валюта", order.currencyLabel],
    ["Склад", order.warehouseName ?? "—"]
  ];
  for (const [label, val] of meta) {
    sheet.mergeCells(row, 1, row, 3);
    const lc = sheet.getCell(row, 1);
    lc.value = label;
    lc.font = { bold: true };
    lc.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    sheet.mergeCells(row, 4, row, 8);
    const vc = sheet.getCell(row, 4);
    vc.value = val;
    vc.alignment = { vertical: "middle", horizontal: "right", wrapText: true };
    applyBorderRange(sheet, row, 1, row, 8);
    row++;
  }

  row++;
  const codeHeader = options.codeColumn === "barcode" ? "Штрих-код" : "Код";
  sheet.getCell(row, 1).value = "№";
  sheet.getCell(row, 1).font = { bold: true };
  sheet.getCell(row, 1).fill = FILL_HEADER_GREY;
  sheet.mergeCells(row, 2, row, 3);
  const ch = sheet.getCell(row, 2);
  ch.value = codeHeader;
  ch.font = { bold: true };
  ch.fill = FILL_HEADER_GREY;
  ch.alignment = { horizontal: "center", vertical: "middle" };
  const hdrRest: [number, string][] = [
    [4, "Продукт"],
    [5, "Кол-во"],
    [6, "Бонус"],
    [7, "Цена"],
    [8, "Сумма"]
  ];
  for (const [col, text] of hdrRest) {
    const c = sheet.getCell(row, col);
    c.value = text;
    c.font = { bold: true };
    c.fill = FILL_HEADER_GREY;
    c.alignment = { horizontal: col === 4 ? "left" : "right", vertical: "middle" };
  }
  applyBorderRange(sheet, row, 1, row, 8);
  row++;

  const byGroup = new Map<string, NakladnoyLine[]>();
  for (const ln of mergedLines) {
    const k = ln.groupTitle || "Прочее";
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k)!.push(ln);
  }
  const groupKeys = [...byGroup.keys()].sort((a, b) => a.localeCompare(b, "ru"));

  let idx = 1;
  let grandQty = 0;
  let grandBonus = 0;
  let grandSum = 0;

  for (const gk of groupKeys) {
    const groupLines = byGroup.get(gk)!;
    let gQty = 0;
    let gBonus = 0;
    let gSum = 0;
    for (const ln of groupLines) {
      gQty += ln.qty;
      gBonus += ln.bonusQty;
      gSum += ln.sum;
    }
    sheet.mergeCells(row, 1, row, 3);
    for (let c = 1; c <= 3; c++) {
      sheet.getCell(row, c).fill = FILL_GROUP;
    }
    const gn = sheet.getCell(row, 4);
    gn.value = gk;
    gn.font = { bold: true };
    gn.fill = FILL_GROUP;
    gn.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    // TUZATISH: son formatda yozish (matn emas)
    const gq5 = sheet.getCell(row, 5); gq5.value = gQty; gq5.numFmt = NUM_FMT_INT;
    const gb6 = sheet.getCell(row, 6); gb6.value = gBonus; gb6.numFmt = NUM_FMT_INT;
    sheet.getCell(row, 7).value = null;
    const gs8 = sheet.getCell(row, 8); gs8.value = gSum > 0 ? gSum : null; gs8.numFmt = NUM_FMT_MONEY;
    for (let c = 5; c <= 8; c++) {
      const cell = sheet.getCell(row, c);
      cell.fill = FILL_GROUP;
      cell.font = { bold: true };
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
    applyBorderRange(sheet, row, 1, row, 8);
    row++;

    for (const ln of groupLines) {
      sheet.getCell(row, 1).value = idx++;
      sheet.mergeCells(row, 2, row, 3);
      const codeCell = sheet.getCell(row, 2);
      codeCell.value = lineCodeDisplay(ln, options.codeColumn);
      codeCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      const nameCell = sheet.getCell(row, 4);
      nameCell.value = ln.name;
      nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      // TUZATISH: son formatda
      const lq5 = sheet.getCell(row, 5); lq5.value = ln.qty > 0 ? ln.qty : null; lq5.numFmt = NUM_FMT_INT;
      const lb6 = sheet.getCell(row, 6); lb6.value = ln.bonusQty > 0 ? ln.bonusQty : null; lb6.numFmt = NUM_FMT_INT;
      const lp7 = sheet.getCell(row, 7); lp7.value = ln.price > 0 ? ln.price : null; lp7.numFmt = NUM_FMT_MONEY;
      const ls8 = sheet.getCell(row, 8); ls8.value = ln.sum > 0 ? ln.sum : null; ls8.numFmt = NUM_FMT_MONEY;
      for (const c of [5, 6, 7, 8]) {
        sheet.getCell(row, c).alignment = { horizontal: "right", vertical: "middle" };
      }
      applyBorderRange(sheet, row, 1, row, 8);
      grandQty += ln.qty;
      grandBonus += ln.bonusQty;
      grandSum += ln.sum;
      row++;
    }
  }

  sheet.mergeCells(row, 1, row, 4);
  const tot = sheet.getCell(row, 1);
  tot.value = "Итого";
  tot.font = { bold: true };
  tot.fill = FILL_HEADER_GREY;
  tot.alignment = { horizontal: "left", vertical: "middle" };
  // TUZATISH: jami — son formatda
  const tq5 = sheet.getCell(row, 5); tq5.value = grandQty; tq5.numFmt = NUM_FMT_INT;
  const tb6 = sheet.getCell(row, 6); tb6.value = grandBonus; tb6.numFmt = NUM_FMT_INT;
  const ts7 = sheet.getCell(row, 7); ts7.value = grandSum > 0 ? grandSum : null; ts7.numFmt = NUM_FMT_MONEY;
  sheet.getCell(row, 8).value = null;
  for (let c = 5; c <= 8; c++) {
    sheet.getCell(row, c).font = { bold: true };
    sheet.getCell(row, c).fill = FILL_HEADER_GREY;
    sheet.getCell(row, c).alignment = { horizontal: "right", vertical: "middle" };
  }
  applyBorderRange(sheet, row, 1, row, 8);
  row += 2;

  sheet.mergeCells(row, 1, row, 3);
  sheet.getCell(row, 1).value = "___________________________";
  sheet.mergeCells(row, 6, row, 8);
  sheet.getCell(row, 6).value = "___________________________";
  applyBorderRange(sheet, row, 1, row, 8);
  row++;

  sheet.mergeCells(row, 1, row, 3);
  sheet.getCell(row, 1).value = "Складчик";
  sheet.getCell(row, 1).font = { bold: true };
  sheet.mergeCells(row, 6, row, 8);
  sheet.getCell(row, 6).value = "Доставщик";
  sheet.getCell(row, 6).font = { bold: true };
  applyBorderRange(sheet, row, 1, row, 8);

  sheet.pageSetup = {
    orientation: "portrait",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
  };
}

/** Загрузочный лист — sozlamalar: bitta varaq / guruhlar, SKU yoki shtrix-kod. */
export async function buildLoadingSheetWorkbook(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALESDOC";
  wb.created = new Date();

  const payloads = expandLoadingSheetPayloads(orders, options);
  for (const p of payloads) {
    addLoadingSheetWorksheet(wb, p, options);
  }

  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true
  });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}
