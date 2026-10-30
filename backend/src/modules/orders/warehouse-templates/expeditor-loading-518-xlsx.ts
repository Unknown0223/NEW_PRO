import ExcelJS from "exceljs";
import type { NakladnoyBuildOptions, NakladnoyLine, NakladnoyOrderPayload } from "../order-nakladnoy-xlsx.types";
import { fmtDate, lineCodeDisplay, uniqJoin } from "../order-nakladnoy-xlsx.format";
import { loading520Title, sortLoading520GroupKeys } from "../order-nakladnoy-xlsx.consignment-217";
import { buildWarehouseAggregateContext, type WarehouseAggregateContext } from "./warehouse-template-shared";
import {
  numberedSheetName,
  singleSheetOptions,
  splitOrdersIntoSheetGroups,
  uniqueSheetName
} from "./nakladnoy-sheet-groups";
import { repairWorkbookBeforeWrite } from "./warehouse-template-repair";
import { patchWarehouseXlsxBuffer } from "./warehouse-template-zip-patch";

const SHEET_CODE = "518";
const COLS = 7;
const MONEY_FMT = "#,##0";
const FILL_GROUP: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9CEFF" } };
const FILL_BONUS: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBBCCCC" } };
const THIN: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FF000000" } };
const BORDER: Partial<ExcelJS.Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const SIGNATURE_LINE = "___________________________";

function font(size: number, bold = false, argb = "FF000000"): Partial<ExcelJS.Font> {
  return { name: "Calibri", size, bold, color: { argb } };
}

function boxRow(sheet: ExcelJS.Worksheet, row: number) {
  for (let c = 1; c <= COLS; c++) sheet.getCell(row, c).border = BORDER;
}

function put(
  sheet: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: ExcelJS.CellValue,
  style: {
    size?: number;
    bold?: boolean;
    color?: string;
    align?: ExcelJS.Alignment["horizontal"];
    fill?: ExcelJS.Fill;
    money?: boolean;
    wrap?: boolean;
  } = {}
) {
  const cell = sheet.getCell(row, col);
  cell.value = value;
  cell.font = font(style.size ?? 14, style.bold ?? false, style.color);
  cell.alignment = {
    vertical: "middle",
    ...(style.align ? { horizontal: style.align } : {}),
    ...(style.wrap ? { wrapText: true } : {})
  };
  if (style.fill) cell.fill = style.fill;
  if (style.money) cell.numFmt = MONEY_FMT;
}

/** `[NAVOI] ABDURAHMONOV (28.04.2026) 99890…` → telefon olib tashlanadi. */
function expeditorMetaLine(o: NakladnoyOrderPayload): string {
  const line = (o.expeditorLine ?? "").trim();
  if (!line || line === "—") return o.expeditorName?.trim() ?? "";
  const m = /^(.*\(\s*\d{2}\.\d{2}\.\d{4}\s*\))/.exec(line);
  return (m?.[1] ?? line).trim();
}

function byName(a: NakladnoyLine, b: NakladnoyLine): number {
  return a.name.localeCompare(b.name, "ru", { numeric: true, sensitivity: "base" });
}

type Meta518 = {
  dateOrder: string;
  dateShip: string;
  agents: string;
  agentPhones: string;
  territory: string;
  expeditor: string;
  currency: string;
};

function buildMeta(ctx: WarehouseAggregateContext): Meta518 {
  const merged = ctx.merged;
  const phones = uniqJoin(ctx.orders.map((o) => o.agentPhone ?? ""));
  const expeditors = uniqJoin(ctx.orders.map(expeditorMetaLine));
  return {
    dateOrder: fmtDate(merged.createdAt),
    dateShip: fmtDate(merged.shipDate ?? ctx.now),
    agents: ctx.agentLabels.join(", ") || "—",
    agentPhones: phones === "—" ? "" : phones,
    territory: ctx.territoryLabels.join(", ") || "—",
    expeditor: expeditors === "—" ? "" : expeditors,
    currency: merged.currencyLabel || "сум (UZS)"
  };
}

function writeMetaRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string,
  layout: "date" | "pair" | "wide",
  extra = ""
) {
  sheet.mergeCells(row, 1, row, 3);
  put(sheet, row, 1, label, { bold: true });
  if (layout === "wide") {
    sheet.mergeCells(row, 4, row, 7);
    put(sheet, row, 4, value, { wrap: true });
  } else {
    if (layout === "pair") sheet.mergeCells(row, 4, row, 5);
    put(sheet, row, 4, value, { align: "left" });
    sheet.mergeCells(row, 6, row, 7);
    if (extra) put(sheet, row, 6, extra, { align: "left" });
  }
  boxRow(sheet, row);
}

function writeLineRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  num: number,
  ln: NakladnoyLine,
  options: NakladnoyBuildOptions,
  mode: "sale" | "bonus"
) {
  put(sheet, row, 1, num, { align: "center" });
  sheet.mergeCells(row, 2, row, 3);
  put(sheet, row, 2, lineCodeDisplay(ln, options.codeColumn), { size: 12, align: "center" });
  put(sheet, row, 4, ln.name, { wrap: true });
  put(sheet, row, 5, mode === "bonus" ? ln.bonusQty : ln.qty, { align: "right", money: true });
  put(sheet, row, 6, ln.price > 0 ? ln.price : null, { align: "right", money: true });
  put(sheet, row, 7, mode === "sale" ? ln.sum : null, { align: "right", money: true });
  boxRow(sheet, row);
}

function writeSheet518(
  wb: ExcelJS.Workbook,
  sheetName: string,
  ctx: WarehouseAggregateContext,
  options: NakladnoyBuildOptions
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
  const widths = [5.71, 9.71, 12.71, 32.71, 9.71, 12.71, 14.71];
  widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  sheet.properties.defaultRowHeight = 15;

  const meta = buildMeta(ctx);
  let row = 1;

  sheet.mergeCells(row, 1, row, COLS);
  put(sheet, row, 1, loading520Title(ctx.now), { size: 16, bold: true, align: "center" });
  sheet.getRow(row).height = 20;
  boxRow(sheet, row);
  row++;

  writeMetaRow(sheet, row++, "Дата заявки", meta.dateOrder, "date");
  writeMetaRow(sheet, row++, "Дата отгрузки", meta.dateShip, "pair");
  writeMetaRow(sheet, row++, "Агенты", meta.agents, "pair", meta.agentPhones);
  writeMetaRow(sheet, row++, "Территория", meta.territory, "wide");
  writeMetaRow(sheet, row++, "Экспедитор", meta.expeditor, "wide");
  writeMetaRow(sheet, row++, "Валюта", meta.currency, "pair");

  put(sheet, row, 1, "№", { size: 16, bold: true, align: "center" });
  sheet.mergeCells(row, 2, row, 3);
  put(sheet, row, 2, "Код", { size: 16, bold: true, align: "center" });
  put(sheet, row, 4, "Продукт", { size: 16, bold: true, align: "center" });
  put(sheet, row, 5, "Кол-во", { size: 16, bold: true, align: "center" });
  put(sheet, row, 6, "Цена", { size: 16, bold: true, align: "center" });
  put(sheet, row, 7, "Сумма", { size: 16, bold: true, align: "center" });
  boxRow(sheet, row);
  row++;

  const groupKeys = sortLoading520GroupKeys([...ctx.linesByGroup.keys()]);
  let num = 1;
  let totalQty = 0;
  let totalSum = 0;
  const bonusLines: NakladnoyLine[] = [];

  for (const gk of groupKeys) {
    const all = ctx.linesByGroup.get(gk)!;
    bonusLines.push(...all.filter((ln) => ln.bonusQty > 0).sort(byName));
    const lines = all.filter((ln) => ln.qty > 0).sort(byName);
    if (lines.length === 0) continue;
    const gQty = lines.reduce((a, ln) => a + ln.qty, 0);
    const gSum = lines.reduce((a, ln) => a + ln.sum, 0);

    sheet.mergeCells(row, 2, row, 3);
    put(sheet, row, 4, gk, { bold: true, align: "center", fill: FILL_GROUP, wrap: true });
    put(sheet, row, 5, gQty, { align: "right", fill: FILL_GROUP, money: true });
    put(sheet, row, 6, null, { fill: FILL_GROUP });
    put(sheet, row, 7, gSum, { align: "right", fill: FILL_GROUP, money: true });
    boxRow(sheet, row);
    row++;

    for (const ln of lines) {
      writeLineRow(sheet, row++, num++, ln, options, "sale");
      totalQty += ln.qty;
      totalSum += ln.sum;
    }
  }

  sheet.mergeCells(row, 1, row, 4);
  put(sheet, row, 1, "Общая сумма", { size: 16, bold: true, align: "center" });
  put(sheet, row, 5, totalQty, { size: 16, bold: true, align: "right", money: true });
  sheet.mergeCells(row, 6, row, 7);
  put(sheet, row, 6, totalSum, { size: 16, bold: true, align: "right", money: true });
  sheet.getRow(row).height = 20;
  boxRow(sheet, row);
  row++;

  sheet.mergeCells(row, 1, row, COLS);
  if (bonusLines.length > 0) {
    sheet.getRow(row).height = 10;
    row++;
    sheet.mergeCells(row, 2, row, 3);
    put(sheet, row, 4, "Бонус", { size: 16, bold: true, color: "FFFF0000", align: "center", fill: FILL_BONUS });
    put(sheet, row, 5, bonusLines.reduce((a, ln) => a + ln.bonusQty, 0), {
      align: "right",
      fill: FILL_BONUS,
      money: true
    });
    put(sheet, row, 6, null, { fill: FILL_BONUS });
    put(sheet, row, 7, null, { fill: FILL_BONUS });
    boxRow(sheet, row);
    row++;
    let bonusNum = 1;
    for (const ln of bonusLines) writeLineRow(sheet, row++, bonusNum++, ln, options, "bonus");
  }
  row++;

  sheet.mergeCells(row, 1, row, 3);
  put(sheet, row, 1, SIGNATURE_LINE, { size: 11, bold: true });
  sheet.mergeCells(row, 5, row, 7);
  put(sheet, row, 5, SIGNATURE_LINE, { size: 11, bold: true, align: "right" });
  row++;
  sheet.mergeCells(row, 1, row, 3);
  put(sheet, row, 1, "Складчик", { size: 16, align: "center" });
  sheet.mergeCells(row, 6, row, 7);
  put(sheet, row, 6, "Доставщик", { size: 16, align: "center" });

  sheet.pageSetup = {
    paperSize: 9,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.2362, right: 0.2362, top: 0.2362, bottom: 0.2362, header: 0.5, footer: 0.75 }
  };
  return sheet;
}

/** «Загруз зав.склада 5.1.8» — har guruh (экспедитор / агент / территория) alohida varaq. */
export async function buildExpeditorLoading518Xlsx(
  orders: NakladnoyOrderPayload[],
  options: NakladnoyBuildOptions
): Promise<Buffer> {
  if (orders.length === 0) throw new Error("EMPTY_ORDER_IDS");
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALESDOC";
  wb.created = new Date();
  const used = new Set<string>();
  const now = new Date();
  splitOrdersIntoSheetGroups(orders, options).forEach((group, i) => {
    const ctx = buildWarehouseAggregateContext(group.orders, singleSheetOptions(options));
    ctx.now = now;
    writeSheet518(wb, uniqueSheetName(used, numberedSheetName(i + 1, SHEET_CODE, group.label)), ctx, options);
  });
  repairWorkbookBeforeWrite(wb);
  const raw = await wb.xlsx.writeBuffer({ useStyles: true, useSharedStrings: true });
  return patchWarehouseXlsxBuffer(Buffer.from(raw));
}
