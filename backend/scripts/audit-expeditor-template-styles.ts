/**
 * Har bir expeditor shablon: ustunlar, guruh rangi, meta qatorlar.
 * npx tsx scripts/audit-expeditor-template-styles.ts
 */
import { readFileSync } from "fs";
import { join } from "path";
import ExcelJS from "exceljs";
import { preprocessExpeditorTemplateBuffer } from "../src/modules/orders/warehouse-templates/expeditor-template-preprocess";
import {
  EXPEDITOR_LOADING_DEFS,
  type ExpeditorLoadingLayoutId
} from "../src/modules/orders/warehouse-templates/expeditor-loading-template-ids";

const ASSET_DIR = join(__dirname, "../assets/nakladnoy/loading");

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((x) => x.text).join("");
  }
  if (typeof v === "object" && "formula" in (v as object)) {
    const r = (v as ExcelJS.CellFormulaValue).result;
    return r == null ? "" : String(r).trim();
  }
  return String(v).trim();
}

function fillArgb(cell: ExcelJS.Cell): string | null {
  const f = cell.fill;
  if (!f || f.type !== "pattern" || f.pattern === "none") return null;
  const fg = (f as ExcelJS.FillPattern).fgColor?.argb;
  return fg ?? null;
}

function rowText(ws: ExcelJS.Worksheet, r: number, maxCol = 10): string {
  const parts: string[] = [];
  for (let c = 1; c <= maxCol; c++) {
    const t = cellStr(ws.getCell(r, c).value);
    if (t) parts.push(t);
  }
  return parts.join(" | ").slice(0, 120);
}

async function auditOne(id: ExpeditorLoadingLayoutId) {
  const def = EXPEDITOR_LOADING_DEFS.find((d) => d.id === id)!;
  const p = join(ASSET_DIR, def.assetFile);
  const raw = readFileSync(p);
  const fixed = await preprocessExpeditorTemplateBuffer(raw);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(fixed as never);

  let ws = wb.worksheets[0]!;
  let headerRow = -1;
  for (const sheet of wb.worksheets) {
    for (let r = 1; r <= Math.min(sheet.rowCount, 120); r++) {
      const t = rowText(sheet, r).toLowerCase();
      if (t.includes("продукт") && (t.includes("колич") || t.includes("кол-"))) {
        headerRow = r;
        ws = sheet;
        break;
      }
    }
    if (headerRow > 0) break;
  }

  if (headerRow < 0) headerRow = -1;
  let groupSampleRow = -1;
  let productSampleRow = -1;
  const scanFrom = headerRow > 0 ? headerRow : 1;
  const scanTo = headerRow > 0 ? Math.min(ws.rowCount, headerRow + 60) : Math.min(ws.rowCount, 120);
  for (let r = scanFrom; r <= scanTo; r++) {
    if (headerRow < 0) {
      const t = rowText(ws, r).toLowerCase();
      if (t.includes("продукт") && (t.includes("колич") || t.includes("кол-"))) headerRow = r;
    }
  }
  for (let r = headerRow > 0 ? headerRow : 1; r <= scanTo; r++) {
    const t = rowText(ws, r).toLowerCase();
    if (groupSampleRow < 0 && headerRow > 0 && r > headerRow) {
      const fg = fillArgb(ws.getCell(r, 3)) ?? fillArgb(ws.getCell(r, 4));
      if (fg && fg !== "FFFFFFFF" && fg !== "00000000") {
        const c3 = cellStr(ws.getCell(r, 3).value);
        if (c3 && !/^\d+$/.test(c3)) groupSampleRow = r;
      }
    }
    if (productSampleRow < 0 && groupSampleRow > 0 && r > groupSampleRow) {
      const c1 = cellStr(ws.getCell(r, 1).value);
      if (/^\d+$/.test(c1)) {
        productSampleRow = r;
        break;
      }
    }
  }

  const headerCols: Record<string, number> = {};
  if (headerRow > 0) {
    for (let c = 1; c <= 12; c++) {
      const t = cellStr(ws.getCell(headerRow, c).value).toLowerCase();
      if (t) headerCols[t.slice(0, 20)] = c;
    }
  }

  const groupFill =
    groupSampleRow > 0
      ? fillArgb(ws.getCell(groupSampleRow, 3)) ??
        fillArgb(ws.getCell(groupSampleRow, 4)) ??
        fillArgb(ws.getCell(groupSampleRow, 5))
      : null;

  const hdrFill = headerRow > 0 ? fillArgb(ws.getCell(headerRow, 1)) : null;

  return {
    id,
    file: def.assetFile,
    sheetCount: wb.worksheets.length,
    sheet: ws.name,
    rows: ws.rowCount,
    cols: ws.columnCount,
    headerRow,
    groupSampleRow,
    productSampleRow,
    groupFill,
    hdrFill,
    title: rowText(ws, 1, 8).slice(0, 80),
    headerCols
  };
}

async function main() {
  const out: unknown[] = [];
  for (const d of EXPEDITOR_LOADING_DEFS) {
    try {
      out.push(await auditOne(d.id));
    } catch (e) {
      out.push({ id: d.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
