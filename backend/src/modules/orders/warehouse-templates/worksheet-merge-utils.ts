import type ExcelJS from "exceljs";

export function colToNum(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numToCol(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const rem = (x - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

export function toMergeRef(r1: number, c1: number, r2: number, c2: number): string {
  return `${numToCol(c1)}${r1}:${numToCol(c2)}${r2}`;
}

export function parseMergeRef(ref: string): {
  c1: string;
  r1: number;
  c2: string;
  r2: number;
  cn1: number;
  cn2: number;
} | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref.trim());
  if (!m) return null;
  return {
    c1: m[1]!.toUpperCase(),
    r1: +m[2]!,
    c2: m[3]!.toUpperCase(),
    r2: +m[4]!,
    cn1: colToNum(m[1]!),
    cn2: colToNum(m[3]!)
  };
}

export function getWorksheetMergeRefs(ws: ExcelJS.Worksheet): string[] {
  const model = ws as ExcelJS.Worksheet & { model?: { merges?: string[] } };
  return [...(model.model?.merges ?? [])];
}

export function setWorksheetMergeRefs(ws: ExcelJS.Worksheet, refs: string[]): void {
  const model = ws as ExcelJS.Worksheet & { model?: { merges?: string[] } };
  if (!model.model) return;
  model.model.merges = [...new Set(refs.map((r) => r.toUpperCase()))];
}

/**
 * ExcelJS merge larni `_merges` da saqlaydi.
 * spliceRows dan keyin `_unMergeMaster` eski qatorlarga tegishi mumkin — faqat indeksni tozalaymiz.
 */
export function clearWorksheetMerges(ws: ExcelJS.Worksheet): void {
  const w = ws as ExcelJS.Worksheet & { _merges?: Record<string, unknown> };
  w._merges = {};
  setWorksheetMergeRefs(ws, []);
}

export function applyWorksheetMergeRefs(ws: ExcelJS.Worksheet, refs: string[]): void {
  clearWorksheetMerges(ws);
  for (const ref of filterValidNonOverlappingMergeRefs(refs)) {
    try {
      ws.mergeCells(ref);
    } catch {
      /* overlap yoki band qator */
    }
  }
}

export function mergeRefsOverlap(a: string, b: string): boolean {
  const pa = parseMergeRef(a);
  const pb = parseMergeRef(b);
  if (!pa || !pb) return false;
  if (pa.r2 < pb.r1 || pb.r2 < pa.r1) return false;
  if (pa.cn2 < pb.cn1 || pb.cn2 < pa.cn1) return false;
  return true;
}

/** Bir xil hujayra (C2:C2) va ustma-ust tushadigan merge larni olib tashlaydi. */
export function filterValidNonOverlappingMergeRefs(refs: string[]): string[] {
  const out: string[] = [];
  for (const ref of refs) {
    const p = parseMergeRef(ref);
    if (!p) continue;
    if (p.c1 === p.c2 && p.r1 === p.r2) continue;
    if (out.some((x) => mergeRefsOverlap(x, ref))) continue;
    out.push(ref.toUpperCase());
  }
  return out;
}

export function removeMergesTouchingRows(
  ws: ExcelJS.Worksheet,
  rowFrom: number,
  rowTo: number
): void {
  const next = getWorksheetMergeRefs(ws).filter((ref) => {
    const p = parseMergeRef(ref);
    if (!p) return true;
    return p.r2 < rowFrom || p.r1 > rowTo;
  });
  setWorksheetMergeRefs(ws, next);
}

export function clearRowValuesExceptFormulas(ws: ExcelJS.Worksheet, row: number, cols = 8): void {
  for (let c = 1; c <= cols; c++) {
    const cell = ws.getCell(row, c);
    if (!cell.formula) cell.value = null;
  }
}
