import ExcelJS from "exceljs";
import type {
  NakladnoyPreviewCell,
  NakladnoyPreviewPage,
  NakladnoyPreviewResponse
} from "./nakladnoy-preview.types";
import { previewCellText } from "./nakladnoy-preview-format";

const MAX_ROWS = 400;
const MAX_COLS = 24;
const MAX_COLS_WIDE = 50;

function fillArgb(fill: ExcelJS.Fill | undefined): string | undefined {
  if (!fill || fill.type !== "pattern") return undefined;
  const fg = fill.fgColor;
  if (!fg) return undefined;
  if ("argb" in fg && fg.argb) {
    const a = fg.argb.replace(/^FF/i, "");
    return `#${a.length >= 6 ? a.slice(-6) : a}`;
  }
  return undefined;
}

function parseMergeKey(ref: string): { top: number; left: number; bottom: number; right: number } | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref.replace(/\$/g, ""));
  if (!m) return null;
  const col = (letters: string) => {
    let n = 0;
    for (const ch of letters.toUpperCase()) {
      n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return n;
  };
  return {
    left: col(m[1]!),
    top: Number(m[2]),
    right: col(m[3]!),
    bottom: Number(m[4])
  };
}

function isExpeditorHeaderRow(rows: NakladnoyPreviewCell[][], rowIndex: number): boolean {
  const row = rows[rowIndex];
  if (!row) return false;
  for (const cell of row) {
    if (cell.skip) continue;
    const t = cell.v.trim();
    if (t === "ЭКСПЕДИТОР" || t.startsWith("ЭКСПЕДИТОР ")) return true;
  }
  return false;
}

/** 7.0.1 kabi varaqlarda bir nechta «ЭКСПЕДИТОР» blokini alohida sahifalar. */
function splitGridByExpeditorBlocks(
  sheetName: string,
  colCount: number,
  rows: NakladnoyPreviewCell[][]
): NakladnoyPreviewPage[] {
  const starts: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (isExpeditorHeaderRow(rows, i)) starts.push(i);
  }
  if (starts.length <= 1) {
    return [{ sheetName, kind: "grid", grid: { colCount, rows } }];
  }

  const pages: NakladnoyPreviewPage[] = [];
  let part = 0;
  for (let b = 0; b < starts.length; b++) {
    const from = starts[b]!;
    const to = b + 1 < starts.length ? starts[b + 1]! : rows.length;
    const slice = rows.slice(from, to);
    const hasData = slice.some(
      (row) =>
        row.some((c) => !c.skip && c.v && c.v !== "ЭКСПЕДИТОР" && c.v !== "ИТОГО" && !/^шт\.?$/i.test(c.v))
    );
    if (!hasData) continue;
    part++;
    const expName =
      slice[0]?.find((c) => !c.skip && c.v && c.v !== "ЭКСПЕДИТОР")?.v?.slice(0, 40) ?? "";
    const pageName = expName
      ? `${sheetName} — ${expName}`
      : `${sheetName} (${part})`;
    pages.push({
      sheetName: pageName,
      kind: "grid",
      grid: { colCount, rows: slice }
    });
  }
  return pages.length > 0 ? pages : [{ sheetName, kind: "grid", grid: { colCount, rows } }];
}

function sheetToGrid(sheet: ExcelJS.Worksheet): { colCount: number; rows: NakladnoyPreviewCell[][] } {
  const merges: Array<{ top: number; left: number; bottom: number; right: number }> = [];
  const mergeModels = (sheet as ExcelJS.Worksheet & { model?: { merges?: string[] } }).model?.merges;
  if (mergeModels) {
    for (const ref of mergeModels) {
      const p = parseMergeKey(ref);
      if (p) merges.push(p);
    }
  }

  const skip = new Set<string>();
  const spanAt = new Map<string, { colSpan: number; rowSpan: number }>();
  for (const m of merges) {
    const colSpan = m.right - m.left + 1;
    const rowSpan = m.bottom - m.top + 1;
    spanAt.set(`${m.top}:${m.left}`, { colSpan, rowSpan });
    for (let r = m.top; r <= m.bottom; r++) {
      for (let c = m.left; c <= m.right; c++) {
        if (r === m.top && c === m.left) continue;
        skip.add(`${r}:${c}`);
      }
    }
  }

  const dim = sheet.dimensions;
  const rowEnd = Math.min(dim?.bottom ?? sheet.rowCount, MAX_ROWS);
  const sheetWide =
    (sheet.name || "").toLowerCase().includes("загруз") ||
    (dim?.right ?? sheet.columnCount) > MAX_COLS;
  const colCap = sheetWide ? MAX_COLS_WIDE : MAX_COLS;
  const colEnd = Math.min(dim?.right ?? sheet.columnCount, colCap);

  let lastNonEmpty = 0;
  const rows: NakladnoyPreviewCell[][] = [];

  for (let r = 1; r <= rowEnd; r++) {
    const rowCells: NakladnoyPreviewCell[] = [];
    let any = false;
    for (let c = 1; c <= colEnd; c++) {
      if (skip.has(`${r}:${c}`)) {
        rowCells.push({ v: "", skip: true });
        continue;
      }
      const cell = sheet.getCell(r, c);
      const v = previewCellText(cell);
      if (v) any = true;
      const span = spanAt.get(`${r}:${c}`);
      const align =
        cell.alignment?.horizontal === "center"
          ? "center"
          : cell.alignment?.horizontal === "right"
            ? "right"
            : typeof cell.value === "number" ||
                (typeof cell.value === "object" &&
                  cell.value != null &&
                  "result" in cell.value &&
                  typeof (cell.value as { result: unknown }).result === "number")
              ? "right"
              : "left";
      rowCells.push({
        v,
        bold: Boolean(cell.font?.bold),
        bg: fillArgb(cell.fill),
        align,
        ...(span && span.colSpan > 1 ? { colSpan: span.colSpan } : {}),
        ...(span && span.rowSpan > 1 ? { rowSpan: span.rowSpan } : {})
      });
    }
    if (any) lastNonEmpty = rows.length;
    rows.push(rowCells);
  }

  return {
    colCount: colEnd,
    rows: rows.slice(0, lastNonEmpty + 1)
  };
}

export async function workbookBufferToNakladnoyPreview(
  buffer: Buffer,
  meta: { label: string; filename: string }
): Promise<NakladnoyPreviewResponse> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const pages: NakladnoyPreviewPage[] = [];

  for (const sheet of wb.worksheets) {
    if (!sheet || sheet.state === "hidden") continue;
    const { colCount, rows } = sheetToGrid(sheet);
    const split = splitGridByExpeditorBlocks(sheet.name, colCount, rows);
    pages.push(...split);
  }

  if (pages.length === 0) {
    pages.push({
      sheetName: "Sheet1",
      kind: "grid",
      grid: { colCount: 1, rows: [[{ v: "Пустой документ" }]] }
    });
  }

  return {
    label: meta.label,
    filename: meta.filename,
    pages
  };
}
