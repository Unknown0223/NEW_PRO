import type { PivotConfig, PivotRow } from "@salec/pivot-engine";
import type { LocalFlatPivotRowItem } from "@/lib/pivot-flatten";
import { resolveClassicLabels } from "./PivotRow";

export type CellCoord = { rowIndex: number; colIndex: number };

export type RangeSelection = {
  anchor: CellCoord;
  focus: CellCoord;
};

export type NormalizedRange = {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
};

export function normalizeRange(sel: RangeSelection): NormalizedRange {
  return {
    r0: Math.min(sel.anchor.rowIndex, sel.focus.rowIndex),
    r1: Math.max(sel.anchor.rowIndex, sel.focus.rowIndex),
    c0: Math.min(sel.anchor.colIndex, sel.focus.colIndex),
    c1: Math.max(sel.anchor.colIndex, sel.focus.colIndex)
  };
}

export function isCoordInSelection(
  sel: RangeSelection | null,
  rowIndex: number,
  colIndex: number
): boolean {
  if (!sel) return false;
  const { r0, r1, c0, c1 } = normalizeRange(sel);
  return rowIndex >= r0 && rowIndex <= r1 && colIndex >= c0 && colIndex <= c1;
}

export type SelectionVisual = {
  selected: boolean;
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
  focus: boolean;
};

const EMPTY_SELECTION_VISUAL: SelectionVisual = {
  selected: false,
  top: false,
  right: false,
  bottom: false,
  left: false,
  focus: false
};

/**
 * Pixel rect of a selection range relative to the table origin (0,0 = top-left
 * of table including sticky thead). Used by the Excel-like range overlay so the
 * outer perimeter is one continuous box (never loses the top edge under sticky).
 */
export function selectionRangePixelRect(
  sel: RangeSelection | null,
  opts: {
    colWidths: number[];
    rowHeight: number;
    gutterWidth: number;
    headerHeight: number;
  }
): { left: number; top: number; width: number; height: number } | null {
  if (!sel) return null;
  const { r0, r1, c0, c1 } = normalizeRange(sel);
  const { colWidths, rowHeight, gutterWidth, headerHeight } = opts;
  if (rowHeight <= 0 || colWidths.length === 0) return null;
  if (c0 < 0 || c1 < c0) return null;
  let left = gutterWidth;
  for (let i = 0; i < c0; i++) left += Math.max(0, colWidths[i] ?? 0);
  let width = 0;
  for (let i = c0; i <= c1; i++) width += Math.max(0, colWidths[i] ?? 0);
  if (width <= 0) return null;
  return {
    left,
    top: headerHeight + r0 * rowHeight,
    width,
    height: (r1 - r0 + 1) * rowHeight
  };
}

/** Soft fill + which edges get the outer outline (Excel/WDR range). */
export function getSelectionVisual(
  sel: RangeSelection | null,
  rowIndex: number,
  colIndex: number
): SelectionVisual {
  if (!sel || colIndex < 0) return EMPTY_SELECTION_VISUAL;
  const { r0, r1, c0, c1 } = normalizeRange(sel);
  if (rowIndex < r0 || rowIndex > r1 || colIndex < c0 || colIndex > c1) {
    return EMPTY_SELECTION_VISUAL;
  }
  return {
    selected: true,
    top: rowIndex === r0,
    bottom: rowIndex === r1,
    left: colIndex === c0,
    right: colIndex === c1,
    focus: sel.focus.rowIndex === rowIndex && sel.focus.colIndex === colIndex
  };
}

/**
 * Colspan / buffer segment covering [colStart, colEnd] — fill when range intersects;
 * outer edges only where this segment contains the selection's outer boundary.
 */
export function getSpanSelectionVisual(
  sel: RangeSelection | null,
  rowIndex: number,
  colStart: number,
  colEnd: number
): SelectionVisual {
  if (!sel || colEnd < colStart) return EMPTY_SELECTION_VISUAL;
  const { r0, r1, c0, c1 } = normalizeRange(sel);
  if (rowIndex < r0 || rowIndex > r1) return EMPTY_SELECTION_VISUAL;
  const ic0 = Math.max(c0, colStart);
  const ic1 = Math.min(c1, colEnd);
  if (ic0 > ic1) return EMPTY_SELECTION_VISUAL;
  return {
    selected: true,
    top: rowIndex === r0,
    bottom: rowIndex === r1,
    left: ic0 === c0,
    right: ic1 === c1,
    focus:
      sel.focus.rowIndex === rowIndex &&
      sel.focus.colIndex >= colStart &&
      sel.focus.colIndex <= colEnd
  };
}

/** Colspan row-dim label (subtotal/total) — selected if range intersects any dim column. */
export function isColspanDimSelected(
  sel: RangeSelection | null,
  rowIndex: number,
  rowDimCount: number
): boolean {
  return getSpanSelectionVisual(sel, rowIndex, 0, rowDimCount - 1).selected;
}

export function buildPivotColumnKeys(
  valueColumnKeys: string[],
  rowDimCount: number,
  hasRowLabel: boolean,
  useRowDimColumns: boolean
): string[] {
  const keys: string[] = [];
  if (useRowDimColumns && rowDimCount > 0) {
    for (let i = 0; i < rowDimCount; i++) keys.push(`__row_dim_${i}__`);
  } else if (hasRowLabel) {
    keys.push("__row_label__");
  }
  for (const k of valueColumnKeys) {
    if (k !== "__row_label__" && k !== "__row_label__2") keys.push(k);
  }
  return keys;
}

/** Leaf/value column keys from the first available row sample. */
export function extractValueColumnKeys(
  flatRows: LocalFlatPivotRowItem[],
  dataRows: PivotRow[]
): string[] {
  const sampleCells =
    cellsFromFlatItem(flatRows[0]) ??
    dataRows[0]?.cells ??
    null;
  if (!sampleCells) return [];
  return sampleCells
    .filter((c) => c.columnKey !== "__row_label__" && c.columnKey !== "__row_label__2")
    .map((c) => c.columnKey);
}

function cellsFromFlatItem(item: LocalFlatPivotRowItem | undefined) {
  if (!item) return null;
  if (item.type === "row") return item.row.cells;
  if (item.type === "subtotal") return item.subtotal.cells;
  return item.total.cells;
}

export function getFlatRowCellText(
  item: LocalFlatPivotRowItem,
  colKey: string,
  opts: {
    useRowDimColumns: boolean;
    rowFieldCount: number;
    config?: PivotConfig;
  }
): string {
  const dimMatch = /^__row_dim_(\d+)__$/.exec(colKey);
  if (dimMatch) {
    const colIdx = Number(dimMatch[1]);
    if (item.type === "row") {
      const labels = resolveClassicLabels(
        item.pathLabels,
        item.row,
        item.depth,
        opts.rowFieldCount
      );
      return labels[colIdx] ?? "";
    }
    const cells = item.type === "subtotal" ? item.subtotal.cells : item.total.cells;
    const label = cells.find((c) => c.columnKey === "__row_label__");
    return colIdx === 0 ? String(label?.formatted ?? "") : "";
  }

  if (colKey === "__row_label__") {
    if (item.type === "row") {
      const labelCell =
        item.row.cells.find((c) => c.columnKey === "__row_label__") ?? item.row.cells[0];
      return String(labelCell?.formatted ?? item.row.key ?? "");
    }
    const cells = item.type === "subtotal" ? item.subtotal.cells : item.total.cells;
    const label = cells.find((c) => c.columnKey === "__row_label__");
    return String(label?.formatted ?? "");
  }

  const cells =
    item.type === "row"
      ? item.row.cells
      : item.type === "subtotal"
        ? item.subtotal.cells
        : item.total.cells;
  const cell = cells.find((c) => c.columnKey === colKey);
  if (!cell) return "";
  if (cell.isEmpty && (cell.formatted == null || cell.formatted === "")) return "";
  return String(cell.formatted ?? "");
}

/** Serialize a rectangular selection as Excel-friendly TSV. */
export function selectionToTsv(
  flatRows: LocalFlatPivotRowItem[],
  columnKeys: string[],
  sel: RangeSelection,
  opts: {
    useRowDimColumns: boolean;
    rowFieldCount: number;
    config?: PivotConfig;
  }
): string {
  const { r0, r1, c0, c1 } = normalizeRange(sel);
  const lines: string[] = [];
  for (let r = r0; r <= r1; r++) {
    const item = flatRows[r];
    const cells: string[] = [];
    for (let c = c0; c <= c1; c++) {
      const key = columnKeys[c];
      if (!item || !key) {
        cells.push("");
        continue;
      }
      cells.push(escapeTsvCell(getFlatRowCellText(item, key, opts)));
    }
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

function escapeTsvCell(value: string): string {
  if (/[\t\n\r"]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyPivotSelection(
  flatRows: LocalFlatPivotRowItem[],
  columnKeys: string[],
  sel: RangeSelection | null,
  opts: {
    useRowDimColumns: boolean;
    rowFieldCount: number;
    config?: PivotConfig;
  }
): Promise<boolean> {
  if (!sel || columnKeys.length === 0) return false;
  const tsv = selectionToTsv(flatRows, columnKeys, sel, opts);
  return copyTextToClipboard(tsv);
}

/** Parse numeric cell text (currency / spaced digits / locale commas). */
export function parseCellNumber(text: string): number | null {
  if (!text) return null;
  let s = text.trim().replace(/\s/g, "");
  s = s.replace(/[^\d.,\-]/g, "");
  if (!s || s === "-" || s === "." || s === "," || s === "-." || s === "-,") return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export type SelectionStats = {
  sum: number;
  avg: number;
  count: number;
  numericCount: number;
};

/** WDR-style floating stats over the current rectangular selection. */
export function computeSelectionStats(
  flatRows: LocalFlatPivotRowItem[],
  columnKeys: string[],
  sel: RangeSelection | null,
  opts: {
    useRowDimColumns: boolean;
    rowFieldCount: number;
    config?: PivotConfig;
  }
): SelectionStats | null {
  if (!sel || columnKeys.length === 0) return null;
  const { r0, r1, c0, c1 } = normalizeRange(sel);
  let sum = 0;
  let numericCount = 0;
  let count = 0;
  for (let r = r0; r <= r1; r++) {
    const item = flatRows[r];
    for (let c = c0; c <= c1; c++) {
      const key = columnKeys[c];
      if (!key) continue;
      // Empty buffer rows/cols: no value — ignore for stats (same as blank cells).
      if (!item) continue;
      const text = getFlatRowCellText(item, key, opts);
      if (!text.trim()) continue;
      count += 1;
      const n = parseCellNumber(text);
      if (n != null) {
        sum += n;
        numericCount += 1;
      }
    }
  }
  if (count === 0) return null;
  return {
    sum,
    avg: numericCount > 0 ? sum / numericCount : 0,
    count: numericCount > 0 ? numericCount : count,
    numericCount
  };
}
