import type ExcelJS from "exceljs";
import { filterValidNonOverlappingMergeRefs, getWorksheetMergeRefs, setWorksheetMergeRefs } from "./worksheet-merge-utils";

/**
 * Excel nakladnoy repair engine (archive: excel-generator-fixed.ts).
 * XML invalid chars, ExcelJS bad DPI, invalid single-cell merges, ghost worksheets.
 */

/** XML 1.0 da taqiqlangan boshqaruv belgilari. */
const XML_INVALID = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/** exceljs page-setup-xform parseOpen default. */
const EXCELJS_BAD_DPI = 4294967295;

export function sanitizeCellValue(value: ExcelJS.CellValue): ExcelJS.CellValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") {
    return value.replace(XML_INVALID, "");
  }
  if (typeof value === "boolean" || value instanceof Date) return value;
  if (typeof value === "object" && "formula" in value) return value;
  if (typeof value === "object" && "richText" in value) {
    const rt = value as ExcelJS.CellRichTextValue;
    return {
      richText: rt.richText.map((p) => ({ ...p, text: p.text.replace(XML_INVALID, "") }))
    };
  }
  return value;
}

export function sanitizeWorksheetCells(ws: ExcelJS.Worksheet): void {
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.formula) return;
      const v = cell.value;
      if (v === undefined) return;
      const safe = sanitizeCellValue(v);
      if (safe === undefined) {
        cell.value = null;
      } else if (safe !== v) {
        cell.value = safe;
      }
    });
  });
}

export function repairInvalidMerges(ws: ExcelJS.Worksheet): void {
  const merges = getWorksheetMergeRefs(ws);
  if (!merges.length) return;
  setWorksheetMergeRefs(ws, filterValidNonOverlappingMergeRefs(merges));
}

export function stripInvalidPageSetupDpi(ws: ExcelJS.Worksheet): void {
  const ps = ws.pageSetup;
  if (!ps) return;
  const m = ps as ExcelJS.PageSetup & { horizontalDpi?: number; verticalDpi?: number };
  if (m.horizontalDpi === EXCELJS_BAD_DPI) delete m.horizontalDpi;
  if (m.verticalDpi === EXCELJS_BAD_DPI) delete m.verticalDpi;
}

function worksheetHasVisibleData(ws: ExcelJS.Worksheet): boolean {
  let found = false;
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, () => {
      found = true;
    });
  });
  return found;
}

export function removeEmptyWorksheets(wb: ExcelJS.Workbook): void {
  const removeIds: number[] = [];
  for (const ws of wb.worksheets) {
    const name = (ws.name || "").trim().toLowerCase();
    if (name === "worksheet") {
      removeIds.push(ws.id);
      continue;
    }
    if (!worksheetHasVisibleData(ws) && ws.rowCount <= 1) {
      removeIds.push(ws.id);
    }
  }
  for (const id of removeIds) {
    if (wb.worksheets.length > 1) {
      wb.removeWorksheet(id);
    }
  }
}

/** Yuklashdan keyin (archive: repairWorkbookAfterLoad). */
export function repairWorkbookAfterLoad(wb: ExcelJS.Workbook): void {
  removeEmptyWorksheets(wb);
  for (const ws of wb.worksheets) {
    stripInvalidPageSetupDpi(ws);
  }
}

/** Loyiha nomi — loadWarehouseTemplateWorkbook uchun alias. */
export const repairWorkbookAfterExcelJsLoad = repairWorkbookAfterLoad;

/** writeBuffer dan oldin. */
export function repairWorkbookBeforeWrite(wb: ExcelJS.Workbook): void {
  removeEmptyWorksheets(wb);
  for (const ws of wb.worksheets) {
    sanitizeWorksheetCells(ws);
    repairInvalidMerges(ws);
    stripInvalidPageSetupDpi(ws);
  }
}
