import type ExcelJS from "exceljs";

/** XML 1.0 da taqiqlangan boshqaruv belgilari. */
const XML_INVALID = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/** exceljs/lib/xlsx/xform/sheet/page-setup-xform.js parseOpen default. */
const EXCELJS_BAD_DPI = 4294967295;

function stripInvalidPageSetupDpi(ws: ExcelJS.Worksheet): void {
  const ps = ws.pageSetup;
  if (!ps) return;
  const m = ps as ExcelJS.PageSetup & { horizontalDpi?: number; verticalDpi?: number };
  if (m.horizontalDpi === EXCELJS_BAD_DPI) delete m.horizontalDpi;
  if (m.verticalDpi === EXCELJS_BAD_DPI) delete m.verticalDpi;
}

/** load() dan keyin — writeBuffer dan oldin ham chaqiriladi. */
export function repairWorkbookAfterExcelJsLoad(wb: ExcelJS.Workbook): void {
  removeGhostWorksheets(wb);
  for (const ws of wb.worksheets) {
    stripInvalidPageSetupDpi(ws);
  }
}

export function sanitizeCellValue(value: ExcelJS.CellValue): ExcelJS.CellValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (typeof value === "string") {
    const s = value.replace(XML_INVALID, "");
    return s;
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

/** ExcelJS qayta yozganda buziladi: `mergeCell ref="C2:C2"`. */
function repairInvalidMerges(ws: ExcelJS.Worksheet): void {
  const model = ws as ExcelJS.Worksheet & { model?: { merges?: string[] } };
  const merges = model.model?.merges;
  if (!merges?.length) return;
  model.model!.merges = merges.filter((ref) => {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
    if (!m) return true;
    const c1 = m[1]!.toUpperCase();
    const r1 = m[2]!;
    const c2 = m[3]!.toUpperCase();
    const r2 = m[4]!;
    return c1 !== c2 || r1 !== r2;
  });
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

/** Bo‘sh «Worksheet» va boshqa xarita varaqlarni olib tashlash. */
export function removeGhostWorksheets(wb: ExcelJS.Workbook): void {
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

function sanitizeWorksheetCells(ws: ExcelJS.Worksheet): void {
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
  repairInvalidMerges(ws);
}

/** writeBuffer dan oldin — XML buzilishini kamaytiradi. */
export function repairWorkbookBeforeWrite(wb: ExcelJS.Workbook): void {
  repairWorkbookAfterExcelJsLoad(wb);
  for (const ws of wb.worksheets) {
    sanitizeWorksheetCells(ws);
    stripInvalidPageSetupDpi(ws);
  }
}
