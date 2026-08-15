import { DEFAULT_COL_WIDTH } from "./columnSizing";
import {
  getSpanSelectionVisual,
  normalizeRange,
  type RangeSelection,
  type SelectionVisual
} from "./selection";

/** Excel/WDR empty sheet beyond the data region (50×50). */
export const EMPTY_SHEET_COLS = 50;
export const EMPTY_SHEET_ROWS = 50;
export const EMPTY_COL_WIDTH = DEFAULT_COL_WIDTH;

export function emptySheetBufferWidth(cols = EMPTY_SHEET_COLS, colWidth = EMPTY_COL_WIDTH): number {
  return cols * colWidth;
}

export function isEmptySheetRowIndex(index: number, dataRowCount: number): boolean {
  return index >= dataRowCount;
}

/** Synthetic column keys for empty buffer cols (selection / TSV). */
export function emptySheetColKey(index: number): string {
  return `__sheet_empty_${index}__`;
}

export function isEmptySheetColKey(key: string): boolean {
  return key.startsWith("__sheet_empty_");
}

/** Data column keys + empty buffer keys for sheet-wide selection. */
export function buildSelectionColumnKeys(
  dataKeys: string[],
  emptyCols = EMPTY_SHEET_COLS
): string[] {
  const keys = dataKeys.slice();
  for (let i = 0; i < emptyCols; i++) keys.push(emptySheetColKey(i));
  return keys;
}

/** Resolve which empty buffer column was hit inside a colspan buffer cell. */
export function hitEmptySheetColIndex(
  clientX: number,
  targetLeft: number,
  emptyColWidth = EMPTY_COL_WIDTH,
  emptyCols = EMPTY_SHEET_COLS
): number {
  const x = clientX - targetLeft;
  return Math.max(0, Math.min(emptyCols - 1, Math.floor(x / emptyColWidth)));
}

export function hitEmptySheetColKey(
  clientX: number,
  targetLeft: number,
  emptyColWidth = EMPTY_COL_WIDTH,
  emptyCols = EMPTY_SHEET_COLS
): string {
  return emptySheetColKey(hitEmptySheetColIndex(clientX, targetLeft, emptyColWidth, emptyCols));
}

/** Hit-test a colspan cell covering variable-width data columns. */
export function hitDataColIndexByWidths(
  clientX: number,
  targetLeft: number,
  widths: number[]
): number {
  if (widths.length === 0) return 0;
  const x = clientX - targetLeft;
  if (x < 0) return 0;
  let acc = 0;
  for (let i = 0; i < widths.length; i++) {
    acc += Math.max(0, widths[i] ?? 0);
    if (x < acc) return i;
  }
  return widths.length - 1;
}

export function hitDataColKeyByWidths(
  clientX: number,
  targetLeft: number,
  columnKeys: string[],
  columnWidths: Record<string, number>,
  defaultColWidth: number
): string {
  const widths = columnKeys.map((k) => columnWidths[k] ?? defaultColWidth);
  const idx = hitDataColIndexByWidths(clientX, targetLeft, widths);
  return columnKeys[idx] ?? columnKeys[0] ?? "";
}

/** Pixel rect + visual for a selection intersecting data cols on one row. */
export function dataColsSelectionOverlay(
  selection: RangeSelection | null,
  rowIndex: number,
  dataColCount: number,
  widths: number[]
): { left: number; width: number; visual: SelectionVisual } | null {
  if (!selection || dataColCount <= 0 || widths.length === 0) return null;
  const { r0, r1, c0, c1 } = normalizeRange(selection);
  if (rowIndex < r0 || rowIndex > r1) return null;
  const sc0 = Math.max(c0, 0);
  const sc1 = Math.min(c1, dataColCount - 1);
  if (sc0 > sc1) return null;
  let left = 0;
  for (let i = 0; i < sc0; i++) left += Math.max(0, widths[i] ?? 0);
  let width = 0;
  for (let i = sc0; i <= sc1; i++) width += Math.max(0, widths[i] ?? 0);
  return {
    left,
    width,
    visual: getSpanSelectionVisual(selection, rowIndex, sc0, sc1)
  };
}

/** Vertical grid lines for a colspan empty-data cell (variable widths). */
export function columnGuideGradient(widths: number[]): string {
  if (widths.length === 0) return "none";
  const stops: string[] = [];
  let acc = 0;
  for (let i = 0; i < widths.length; i++) {
    const w = Math.max(0, widths[i] ?? 0);
    const lineAt = acc + w - 1;
    const end = acc + w;
    if (w > 0) {
      stops.push(`transparent ${acc}px`);
      stops.push(`transparent ${Math.max(acc, lineAt)}px`);
      stops.push(`var(--pg-border) ${Math.max(acc, lineAt)}px`);
      stops.push(`var(--pg-border) ${end}px`);
    }
    acc = end;
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/**
 * Sheet rows occupied by the field-header band (not the col-index strip).
 * WDR-style gutters number these 1..H; data starts at H+1.
 */
export function sheetHeaderBandRows(headerLevelCount: number): number {
  return Math.max(headerLevelCount, 1);
}

/** 1-based sheet row number for a field-header band row (0-based level). */
export function headerSheetRowNumber(levelIndex: number): number {
  return levelIndex + 1;
}

/**
 * 1-based sheet row number for a data or empty-buffer body row.
 * `headerBandRows` shifts numbering so field headers own 1..H.
 */
export function sheetRowNumber(index: number, headerBandRows = 0): number {
  return index + 1 + headerBandRows;
}

export function emptySheetRowNumber(index: number, headerBandRows = 0): number {
  return sheetRowNumber(index, headerBandRows);
}
