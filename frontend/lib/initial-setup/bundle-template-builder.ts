import ExcelJS from "exceljs";
import type { BundleTemplateSheet } from "@/lib/initial-setup/bundle-template-sheets";
import {
  buildSamplesMetadataRows,
  TEMPLATE_SAMPLES_SHEET
} from "@/lib/initial-setup/template-sample-matcher";
import {
  hintForStep,
  START_SHEET_TAB,
  STEP_SHEET_TAB,
  tabLabelForStep
} from "@/lib/initial-setup/sheet-labels";

const C = {
  navy: "FF1E3A5F",
  teal: "FF0F766E",
  white: "FFFFFFFF",
  slate50: "FFF8FAFC",
  slate200: "FFE2E8F0",
  slate500: "FF64748B",
  blue: "FF2563EB",
  emerald: "FF059669",
  amber: "FFD97706",
  violet: "FF7C3AED"
} as const;

const SKIP_TABS = new Set([
  "start",
  "инструкция",
  "_readme",
  "начало",
  "boshlash",
  "_samples"
]);

export function isSkippedTemplateSheet(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/ё/g, "е");
  return SKIP_TABS.has(n) || name.startsWith("_");
}

function tabColorForStep(stepId: string): string {
  if (
    [
      "company",
      "units",
      "currencies",
      "payment-methods",
      "price-types",
      "trade-directions",
      "sales-channels",
      "branches"
    ].includes(stepId)
  ) {
    return C.blue;
  }
  if (["client-formats", "client-types", "client-categories"].includes(stepId)) {
    return C.emerald;
  }
  if (["products-catalog", "product-prices"].includes(stepId)) {
    return C.amber;
  }
  if (["clients", "work-slots", "stock-receipts"].includes(stepId)) {
    return C.violet;
  }
  return C.slate500;
}

function applyHeaderStyle(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: C.white }, size: 11 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.teal } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = {
    top: { style: "thin", color: { argb: C.slate200 } },
    left: { style: "thin", color: { argb: C.slate200 } },
    bottom: { style: "thin", color: { argb: C.slate200 } },
    right: { style: "thin", color: { argb: C.slate200 } }
  };
}

function applySampleStyle(cell: ExcelJS.Cell) {
  cell.font = { italic: true, color: { argb: C.slate500 }, size: 10 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.slate50 } };
}

function applyDataStyle(cell: ExcelJS.Cell) {
  cell.font = { size: 10, color: { argb: "FF0F172A" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.white } };
  cell.border = {
    top: { style: "thin", color: { argb: C.slate200 } },
    left: { style: "thin", color: { argb: C.slate200 } },
    bottom: { style: "thin", color: { argb: C.slate200 } },
    right: { style: "thin", color: { argb: C.slate200 } }
  };
}

export type StyledWorkbookOptions = {
  /** Shablon uchun namuna qatorlar metadata (eksportda false). */
  includeSamples?: boolean;
  /** Shablon: kulrang kursiv namuna; eksport: oddiy ma’lumot qatori. */
  dataRowStyle?: "sample" | "data";
};

async function workbookToBlob(wb: ExcelJS.Workbook): Promise<Blob> {
  const buf = await wb.xlsx.writeBuffer();
  const part: BlobPart =
    buf instanceof ArrayBuffer
      ? buf
      : ArrayBuffer.isView(buf)
        ? buf
        : new Uint8Array(buf as ArrayBuffer);
  return new Blob([part], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

async function addStartSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet(START_SHEET_TAB, {
    views: [{ showGridLines: false }],
    properties: { tabColor: { argb: C.navy } }
  });

  ws.mergeCells("A1:F1");
  const t = ws.getCell("A1");
  t.value = "Начальная настройка";
  t.font = { bold: true, size: 16, color: { argb: C.white } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.navy } };
  t.alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).height = 36;

  const lines = [
    "Каждый лист — отдельный раздел. Не переименовывайте вкладки.",
    "Порядок: Основа → Справочники клиента → Продукты → Клиенты",
    "Зелёная строка — заголовки. Серый курсив — пример (можно удалить или заменить своими данными).",
    "Неизменённые примеры при загрузке игнорируются — в систему не попадают.",
    "Звёздочка (*) в заголовке — обязательное поле."
  ];

  let row = 3;
  for (const text of lines) {
    ws.mergeCells(`A${row}:F${row}`);
    const c = ws.getCell(`A${row}`);
    c.value = text;
    c.font = { size: 11 };
    c.alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(row).height = 22;
    row++;
  }

  row += 1;
  ws.getCell(`A${row}`).value = "Группы листов";
  ws.getCell(`A${row}`).font = { bold: true, size: 11 };
  row++;

  const legend: [string, string][] = [
    ["Основа (синий)", "Компания, Единицы, Валюты, Филиалы…"],
    ["Справочники клиента (зелёный)", "Формат, Тип, Категория клиента"],
    ["Продукты (жёлтый)", "Продукты, Цены"],
    ["Операции (фиолетовый)", "Клиенты, Слоты, Поступление"]
  ];
  for (const [g, ex] of legend) {
    ws.getCell(`A${row}`).value = g;
    ws.getCell(`B${row}`).value = ex;
    ws.getCell(`A${row}`).font = { bold: true, size: 10 };
    row++;
  }

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 42;
}

function addStyledDataSheet(
  wb: ExcelJS.Workbook,
  sheet: BundleTemplateSheet,
  dataRowStyle: "sample" | "data" = "sample"
) {
  const stepId = sheet.sheetName;
  const tabLabel = tabLabelForStep(stepId);
  const ws = wb.addWorksheet(tabLabel.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { tabColor: { argb: tabColorForStep(stepId) } }
  });

  const hint = hintForStep(stepId);
  if (hint) {
    ws.getCell("A1").note = hint;
  }

  if (!sheet.rows.length) return;

  const [header, ...samples] = sheet.rows;
  const headerRow = ws.getRow(1);
  header.forEach((text, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = text;
    applyHeaderStyle(cell);
  });
  headerRow.height = 24;

  samples.forEach((sample, ri) => {
    const dataRow = ws.getRow(ri + 2);
    sample.forEach((text, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = text ?? "";
      if (dataRowStyle === "sample") applySampleStyle(cell);
      else applyDataStyle(cell);
    });
    dataRow.height = 20;
  });

  header.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(32, Math.max(12, h.length + 4));
  });
}

function addSamplesMetadataSheet(wb: ExcelJS.Workbook, sheets: BundleTemplateSheet[]) {
  const rows = buildSamplesMetadataRows(sheets);
  if (rows.length <= 1) return;
  const ws = wb.addWorksheet(TEMPLATE_SAMPLES_SHEET, {
    state: "veryHidden",
    properties: { tabColor: { argb: C.slate200 } }
  });
  rows.forEach((line, ri) => {
    const row = ws.getRow(ri + 1);
    line.forEach((text, ci) => {
      row.getCell(ci + 1).value = text;
    });
  });
}

export async function buildStyledWorkbook(
  sheets: BundleTemplateSheet[],
  options?: StyledWorkbookOptions
): Promise<Blob> {
  const dataRowStyle = options?.dataRowStyle ?? "sample";
  const wb = new ExcelJS.Workbook();
  wb.creator = "SALEC";
  wb.created = new Date();

  await addStartSheet(wb);
  for (const sheet of sheets) {
    if (isSkippedTemplateSheet(sheet.sheetName)) continue;
    addStyledDataSheet(wb, sheet, dataRowStyle);
  }
  if (options?.includeSamples !== false) {
    addSamplesMetadataSheet(wb, sheets);
  }

  return workbookToBlob(wb);
}

export async function buildStyledSingleSheet(sheet: BundleTemplateSheet): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  addStyledDataSheet(wb, sheet);
  addSamplesMetadataSheet(wb, [sheet]);
  return workbookToBlob(wb);
}

export async function restyleServerSheetBuffer(
  buffer: ArrayBuffer,
  sheetName: string
): Promise<BundleTemplateSheet | null> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const src = wb.worksheets[0];
  if (!src) return null;
  const rows: string[][] = [];
  src.eachRow((row) => {
    const line: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      while (line.length < col - 1) line.push("");
      line[col - 1] = String(cell.text ?? cell.value ?? "").trim();
    });
    if (line.some((c) => c.length > 0)) rows.push(line);
  });
  if (!rows.length) return null;
  return { sheetName, rows };
}

/** Eksport: ruscha varaq nomlari ro‘yxati (UI) */
export { STEP_SHEET_TAB, tabLabelForStep };
