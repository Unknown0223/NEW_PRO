import ExcelJS from "exceljs";
import { applyBorderRange, FILL_HEADER_GREY } from "../order-nakladnoy-xlsx.format";
import { repairWorkbookBeforeWrite } from "./warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-template-zip-patch";
import type { ExpeditorLoading520Document } from "./expeditor-loading-520-document";

/** 5.2.0 shablonidagi binafsha guruh qatori */
const FILL_GROUP_520: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE9CEFF" }
};

function parseMoney(s: string): number {
  const n = Number(s.replace(/\s/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

export async function buildExpeditorLoading520XlsxFromDocument(
  doc: ExpeditorLoading520Document
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALESDOC";
  wb.created = new Date();
  const sheet = wb.addWorksheet("1.520.", { views: [{ showGridLines: true }] });

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 46;
  sheet.getColumn(5).width = 11;
  sheet.getColumn(6).width = 11;
  sheet.getColumn(7).width = 13;
  sheet.getColumn(8).width = 15;
  sheet.properties.defaultRowHeight = 18;

  let row = 1;

  sheet.mergeCells(row, 1, row, 8);
  const titleCell = sheet.getCell(row, 1);
  titleCell.value = doc.title;
  titleCell.font = { bold: true, size: 12 };
  titleCell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  applyBorderRange(sheet, row, 1, row, 8);
  row++;

  writeMetaRow(sheet, row++, "Дата заказа:", doc.meta.dateOrder);
  writeMetaRow(sheet, row++, "Дата отгрузки:", doc.meta.dateShip ?? "—");
  writeMetaRow(
    sheet,
    row++,
    "Торговый представитель:",
    doc.meta.agents,
    doc.meta.agentPhonesVisible ? doc.meta.agentPhones : undefined
  );
  writeMetaRow(sheet, row++, "Территория:", doc.meta.territory);

  const expeditorRow = row;
  writeMetaRow(sheet, row++, "Экспедитор:", doc.meta.expeditor ?? "");
  if (!doc.meta.expeditorVisible) {
    sheet.getRow(expeditorRow).hidden = true;
  }

  writeMetaRow(sheet, row++, "Валюта:", doc.meta.currency);

  const codeHeader = "Код";
  sheet.getCell(row, 1).value = "№";
  sheet.getCell(row, 1).font = { bold: true };
  sheet.getCell(row, 1).fill = FILL_HEADER_GREY;
  sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
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

  for (const g of doc.groups) {
    sheet.mergeCells(row, 2, row, 3);
    for (let c = 1; c <= 3; c++) sheet.getCell(row, c).fill = FILL_GROUP_520;
    const gn = sheet.getCell(row, 4);
    gn.value = g.name;
    gn.font = { bold: true };
    gn.fill = FILL_GROUP_520;
    gn.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    sheet.getCell(row, 5).value = g.qty > 0 ? g.qty : "";
    sheet.getCell(row, 6).value = g.bonus > 0 ? g.bonus : "";
    sheet.getCell(row, 7).value = "";
    sheet.getCell(row, 8).value = g.sum;
    for (let c = 5; c <= 8; c++) {
      const cell = sheet.getCell(row, c);
      cell.fill = FILL_GROUP_520;
      cell.font = { bold: true };
      cell.alignment = { horizontal: "right", vertical: "middle" };
    }
    applyBorderRange(sheet, row, 1, row, 8);
    row++;

    for (const ln of g.lines) {
      sheet.getCell(row, 1).value = ln.num;
      sheet.getCell(row, 1).alignment = { horizontal: "center", vertical: "middle" };
      sheet.mergeCells(row, 2, row, 3);
      const codeCell = sheet.getCell(row, 2);
      codeCell.value = ln.code;
      codeCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      const nameCell = sheet.getCell(row, 4);
      nameCell.value = ln.name;
      nameCell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      sheet.getCell(row, 5).value = ln.qty ?? "";
      sheet.getCell(row, 6).value = ln.bonus ?? "";
      sheet.getCell(row, 7).value = ln.price;
      sheet.getCell(row, 8).value = ln.sum;
      for (const c of [5, 6, 7, 8]) {
        sheet.getCell(row, c).alignment = { horizontal: "right", vertical: "middle" };
      }
      applyBorderRange(sheet, row, 1, row, 8);
      row++;
    }
  }

  sheet.mergeCells(row, 1, row, 4);
  const tot = sheet.getCell(row, 1);
  tot.value = "Итого";
  tot.font = { bold: true };
  tot.fill = FILL_HEADER_GREY;
  tot.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getCell(row, 5).value = doc.totals.qty;
  sheet.getCell(row, 6).value = doc.totals.bonus;
  const sumNum = parseMoney(doc.totals.sum);
  sheet.mergeCells(row, 7, row, 8);
  sheet.getCell(row, 7).value = sumNum > 0 ? doc.totals.sum : "";
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
  sheet.getCell(row, 1).value = "Складчик:";
  sheet.getCell(row, 1).font = { bold: true };
  sheet.mergeCells(row, 6, row, 8);
  sheet.getCell(row, 6).value = "Доставщик:";
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

  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}

function writeMetaRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string,
  extra?: string
) {
  sheet.mergeCells(row, 1, row, 3);
  const lc = sheet.getCell(row, 1);
  lc.value = label;
  lc.font = { bold: true };
  lc.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  sheet.getCell(row, 4).value = value;
  sheet.getCell(row, 4).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  if (extra) {
    sheet.getCell(row, 6).value = extra;
    sheet.getCell(row, 6).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  }
  applyBorderRange(sheet, row, 1, row, 8);
}
