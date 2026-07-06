"use client";

import {
  collectGroupKeysInOrder,
  isGroupInterleaveCategory,
  normalizeSheetGroupKey,
  shouldInterleaveBulkSheetsByGroup
} from "@/lib/bulk-export-sheet-grouping";
import type { BulkExportCategoryId } from "@/lib/bulk-export-templates";
import type { NakladnoyGroupBy } from "@/lib/order-nakladnoy";
import type { Worksheet } from "exceljs";

type ExcelJS = typeof import("exceljs");
type ExcelWorkbook = import("exceljs").Workbook;

export type XlsxSheetSource = {
  label: string;
  templateId: string;
  category: BulkExportCategoryId;
  separateSheets: boolean;
  groupBy: NakladnoyGroupBy;
  data: Blob | ArrayBuffer;
};

type LoadedSheet = {
  name: string;
  worksheet: Worksheet;
};

type LoadedWorkbook = {
  source: XlsxSheetSource;
  sheets: LoadedSheet[];
};

/** Excel varaq nomi: max 31 belgi, takrorlanmas. */
export function uniqueExcelSheetName(base: string, used: Set<string>): string {
  let safe = base.replace(/[\\/?*[\]:]/g, "_").replace(/\s+/g, " ").trim() || "Лист";
  if (safe.length > 31) safe = safe.slice(0, 31);
  if (!used.has(safe)) {
    used.add(safe);
    return safe;
  }
  let n = 2;
  while (n < 100) {
    const suffix = ` ${n}`;
    const stem = base
      .replace(/[\\/?*[\]:]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, Math.max(1, 31 - suffix.length));
    const candidate = stem + suffix;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    n++;
  }
  const fallback = `Лист${used.size}`;
  used.add(fallback);
  return fallback;
}

function copyWorksheet(src: Worksheet, dest: Worksheet): void {
  src.columns?.forEach((col, idx) => {
    const w = col.width;
    if (w != null && w > 0) dest.getColumn(idx + 1).width = w;
  });

  const values = src.getSheetValues();
  if (values && values.length > 0) {
    dest.addRows(values);
  } else {
    src.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const destRow = dest.getRow(rowNumber);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        destRow.getCell(colNumber).value = cell.value;
      });
      destRow.commit();
    });
  }

  const model = src as Worksheet & { model?: { merges?: string[] } };
  for (const range of model.model?.merges ?? []) {
    try {
      dest.mergeCells(range);
    } catch {
      /* ignore */
    }
  }
}

async function toArrayBuffer(data: Blob | ArrayBuffer): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return data;
  return data.arrayBuffer();
}

async function loadWorkbook(source: XlsxSheetSource): Promise<LoadedWorkbook> {
  const buf = await toArrayBuffer(source.data);
  const ExcelJSMod = (await import("exceljs")) as { default: ExcelJS };
  const ExcelJS = ExcelJSMod.default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Excel o‘qish (${source.label}): ${detail}`);
  }
  const sheets = wb.worksheets.map((worksheet) => ({
    name: worksheet.name,
    worksheet
  }));
  if (sheets.length === 0) {
    throw new Error(`Bo‘sh hujjat: ${source.label}`);
  }
  return { source, sheets };
}

function appendSheet(
  outWb: ExcelWorkbook,
  usedSheetNames: Set<string>,
  srcSheet: LoadedSheet,
  sourceLabel: string,
  multiInSource: boolean
): void {
  const suffix =
    multiInSource && srcSheet.name ? `${sourceLabel} - ${srcSheet.name}` : sourceLabel;
  const sheetName = uniqueExcelSheetName(suffix, usedSheetNames);
  const destSheet = outWb.addWorksheet(sheetName);
  copyWorksheet(srcSheet.worksheet, destSheet);
}

function appendWorkbooksFlat(
  outWb: ExcelWorkbook,
  usedSheetNames: Set<string>,
  loaded: LoadedWorkbook[]
): void {
  for (const wb of loaded) {
    const multi = wb.sheets.length > 1;
    for (const sheet of wb.sheets) {
      appendSheet(outWb, usedSheetNames, sheet, wb.source.label, multi);
    }
  }
}

/**
 * «Загруз экспедитор» + «Накладные»: bir xil dostavchik/agent/hudud varaqlari yonma-yon.
 */
function appendWorkbooksInterleaved(
  outWb: ExcelWorkbook,
  usedSheetNames: Set<string>,
  loaded: LoadedWorkbook[]
): void {
  const grouped = loaded.filter(
    (w) => isGroupInterleaveCategory(w.source.category) && w.source.separateSheets
  );
  const other = loaded.filter((w) => !grouped.includes(w));

  for (const wb of other) {
    const multi = wb.sheets.length > 1;
    for (const sheet of wb.sheets) {
      appendSheet(outWb, usedSheetNames, sheet, wb.source.label, multi);
    }
  }

  if (grouped.length === 0) return;

  const sheetNamesByTemplate = grouped.map((g) => g.sheets.map((s) => s.name));
  const groupKeys = collectGroupKeysInOrder(sheetNamesByTemplate, 0);
  const usedSrc = new Set<string>();

  for (const groupKey of groupKeys) {
    for (const wb of grouped) {
      for (const sheet of wb.sheets) {
        if (normalizeSheetGroupKey(sheet.name) !== groupKey) continue;
        const uid = `${wb.source.templateId}\0${sheet.name}`;
        if (usedSrc.has(uid)) continue;
        usedSrc.add(uid);
        appendSheet(outWb, usedSheetNames, sheet, wb.source.label, true);
      }
    }
  }

  for (const wb of grouped) {
    for (const sheet of wb.sheets) {
      const uid = `${wb.source.templateId}\0${sheet.name}`;
      if (usedSrc.has(uid)) continue;
      usedSrc.add(uid);
      appendSheet(outWb, usedSheetNames, sheet, wb.source.label, wb.sheets.length > 1);
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((v) => {
        window.clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        window.clearTimeout(timer);
        reject(e);
      });
  });
}

export async function mergeXlsxSourcesToBuffer(sources: XlsxSheetSource[]): Promise<ArrayBuffer> {
  if (sources.length === 0) {
    throw new Error("Birlashtirish uchun fayl yo‘q.");
  }

  return withTimeout(
    mergeXlsxSourcesToBufferInner(sources),
    90_000,
    "Birlashtirish juda uzoq davom etdi (90s). Qayta urinib ko‘ring."
  );
}

async function mergeXlsxSourcesToBufferInner(sources: XlsxSheetSource[]): Promise<ArrayBuffer> {
  const ExcelJSMod = (await import("exceljs")) as { default: ExcelJS };
  const ExcelJS = ExcelJSMod.default;
  const outWb = new ExcelJS.Workbook();
  const usedSheetNames = new Set<string>();

  const loaded: LoadedWorkbook[] = [];
  for (const source of sources) {
    loaded.push(await loadWorkbook(source));
  }

  if (shouldInterleaveBulkSheetsByGroup(sources)) {
    appendWorkbooksInterleaved(outWb, usedSheetNames, loaded);
  } else {
    appendWorkbooksFlat(outWb, usedSheetNames, loaded);
  }

  if (outWb.worksheets.length === 0) {
    throw new Error("Birlashtirilgan fayl bo‘sh.");
  }

  try {
    return (await outWb.xlsx.writeBuffer()) as ArrayBuffer;
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`Excel yozish: ${detail}`);
  }
}
