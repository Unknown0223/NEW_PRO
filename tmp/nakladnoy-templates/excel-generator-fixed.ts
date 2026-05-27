import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ASOSIY MUAMMOLAR VA YECHIMLAR:
 * 
 * 1. XML INVALID CHARACTERS
 *    - Muammo: \x00-\x08, \x0B, \x0C, \x0E-\x1F belgilari XML da taqiqlangan
 *    - Yechim: Barcha cell value larni sanitize qilish
 * 
 * 2. EXCELJS BAD DPI
 *    - Muammo: ExcelJS pageSetup da 4294967295 DPI yozadi (default qiymat)
 *    - Yechim: Bu qiymatni o'chirish yoki to'g'rilash
 * 
 * 3. INVALID MERGE CELLS
 *    - Muammo: C2:C2 kabi bir xil hujayra merge qilingan
 *    - Yechim: Faqat har xil hujayralarni merge qilish
 * 
 * 4. SHARED STRINGS VA STYLES
 *    - Muammo: ExcelJS ba'zan noto'g'ri shared strings yaratadi
 *    - Yechim: useSharedStrings: true, useStyles: true bilan yozish
 */

// XML da taqiqlangan belgilar
const XML_INVALID = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

// ExcelJS ning noto'g'ri DPI qiymati
const EXCELJS_BAD_DPI = 4294967295;

/**
 * Cell qiymatini XML uchun xavfsiz qilish
 */
export function sanitizeCellValue(value: ExcelJS.CellValue): ExcelJS.CellValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  
  if (typeof value === 'string') {
    // XML invalid belgilarni olib tashlash
    return value.replace(XML_INVALID, '');
  }
  
  if (typeof value === 'boolean' || value instanceof Date) {
    return value;
  }
  
  // Formula
  if (typeof value === 'object' && 'formula' in value) {
    return value;
  }
  
  // Rich text
  if (typeof value === 'object' && 'richText' in value) {
    const rt = value as ExcelJS.CellRichTextValue;
    return {
      richText: rt.richText.map(p => ({
        ...p,
        text: p.text.replace(XML_INVALID, '')
      }))
    };
  }
  
  return value;
}

/**
 * Worksheet dagi barcha cell qiymatlarni sanitize qilish
 */
export function sanitizeWorksheetCells(ws: ExcelJS.Worksheet): void {
  ws.eachRow({ includeEmpty: true }, (row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      // Formula bor bo'lsa, o'zgartirmaslik
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

/**
 * Noto'g'ri merge cell larni to'g'rilash
 * Masalan: C2:C2 - bir xil hujayra merge qilinmasligi kerak
 */
export function repairInvalidMerges(ws: ExcelJS.Worksheet): void {
  const model = ws as ExcelJS.Worksheet & { model?: { merges?: string[] } };
  const merges = model.model?.merges;
  if (!merges?.length) return;
  
  // Faqat har xil hujayralarni qoldirish
  model.model!.merges = merges.filter(ref => {
    const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
    if (!m) return true; // format noto'g'ri bo'lsa, qoldirish
    
    const c1 = m[1]!.toUpperCase();
    const r1 = m[2]!;
    const c2 = m[3]!.toUpperCase();
    const r2 = m[4]!;
    
    // Agar bir xil hujayra bo'lsa, olib tashlash
    return c1 !== c2 || r1 !== r2;
  });
}

/**
 * PageSetup dagi noto'g'ri DPI qiymatlarni o'chirish
 */
export function stripInvalidPageSetupDpi(ws: ExcelJS.Worksheet): void {
  const ps = ws.pageSetup;
  if (!ps) return;
  
  const m = ps as ExcelJS.PageSetup & { 
    horizontalDpi?: number; 
    verticalDpi?: number 
  };
  
  if (m.horizontalDpi === EXCELJS_BAD_DPI) delete m.horizontalDpi;
  if (m.verticalDpi === EXCELJS_BAD_DPI) delete m.verticalDpi;
}

/**
 * Bo'sh worksheet larni olib tashlash
 */
export function removeEmptyWorksheets(wb: ExcelJS.Workbook): void {
  const removeIds: number[] = [];
  
  for (const ws of wb.worksheets) {
    const name = (ws.name || '').trim().toLowerCase();
    
    // "Worksheet" nomli bo'sh varaqlar
    if (name === 'worksheet') {
      removeIds.push(ws.id);
      continue;
    }
    
    // Ma'lumot yo'q bo'lsa
    let hasData = false;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, () => {
        hasData = true;
      });
    });
    
    if (!hasData && ws.rowCount <= 1) {
      removeIds.push(ws.id);
    }
  }
  
  // Kamida bitta worksheet qolishi kerak
  for (const id of removeIds) {
    if (wb.worksheets.length > 1) {
      wb.removeWorksheet(id);
    }
  }
}

/**
 * Workbook ni yuklashdan keyin tuzatish
 */
export function repairWorkbookAfterLoad(wb: ExcelJS.Workbook): void {
  removeEmptyWorksheets(wb);
  
  for (const ws of wb.worksheets) {
    stripInvalidPageSetupDpi(ws);
  }
}

/**
 * Workbook ni yozishdan oldin tuzatish
 */
export function repairWorkbookBeforeWrite(wb: ExcelJS.Workbook): void {
  removeEmptyWorksheets(wb);
  
  for (const ws of wb.worksheets) {
    sanitizeWorksheetCells(ws);
    repairInvalidMerges(ws);
    stripInvalidPageSetupDpi(ws);
  }
}

/**
 * Xavfsiz Excel fayl yaratish
 */
export async function createSafeExcelFile(
  outputPath: string,
  buildFunction: (wb: ExcelJS.Workbook) => Promise<void> | void
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SALESDOC';
  wb.created = new Date();
  wb.modified = new Date();
  
  // Worksheet larni yaratish
  await buildFunction(wb);
  
  // Tuzatishlar
  repairWorkbookBeforeWrite(wb);
  
  // Xavfsiz yozish
  await wb.xlsx.writeFile(outputPath, {
    useStyles: true,
    useSharedStrings: true
  });
  
  console.log(`✓ Fayl yaratildi: ${outputPath}`);
}

/**
 * Mavjud faylni tuzatish
 */
export async function repairExistingFile(
  inputPath: string,
  outputPath?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(inputPath);
  
  // Yuklashdan keyin tuzatish
  repairWorkbookAfterLoad(wb);
  
  // Yozishdan oldin tuzatish
  repairWorkbookBeforeWrite(wb);
  
  // Saqlash
  const savePath = outputPath || inputPath;
  await wb.xlsx.writeFile(savePath, {
    useStyles: true,
    useSharedStrings: true
  });
  
  console.log(`✓ Fayl tuzatildi: ${savePath}`);
}

// Export qilish
export default {
  sanitizeCellValue,
  sanitizeWorksheetCells,
  repairInvalidMerges,
  stripInvalidPageSetupDpi,
  removeEmptyWorksheets,
  repairWorkbookAfterLoad,
  repairWorkbookBeforeWrite,
  createSafeExcelFile,
  repairExistingFile
};
