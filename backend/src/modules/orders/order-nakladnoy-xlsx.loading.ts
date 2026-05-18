import ExcelJS from "exceljs";
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
    sheet.getCell(row, 5).value = gQty;
    sheet.getCell(row, 6).value = gBonus;
    sheet.getCell(row, 7).value = "";
    sheet.getCell(row, 8).value = fmtMoneyInt(gSum);
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
      sheet.getCell(row, 5).value = ln.qty;
      sheet.getCell(row, 6).value = ln.bonusQty;
      sheet.getCell(row, 7).value = fmtMoneyInt(ln.price);
      sheet.getCell(row, 8).value = fmtMoneyInt(ln.sum);
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
  sheet.getCell(row, 5).value = grandQty;
  sheet.getCell(row, 6).value = grandBonus;
  sheet.getCell(row, 7).value = fmtMoneyInt(grandSum);
  sheet.getCell(row, 8).value = "";
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

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
