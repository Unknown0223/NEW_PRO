import { describe, expect, it } from "vitest";
import {
  computePivotColumnWidths,
  ROW_GUTTER_W
} from "../components/pivot/PivotTable/columnSizing";
import {
  EMPTY_COL_WIDTH,
  EMPTY_SHEET_COLS,
  EMPTY_SHEET_ROWS,
  buildSelectionColumnKeys,
  dataColsSelectionOverlay,
  emptySheetBufferWidth,
  emptySheetColKey,
  emptySheetRowNumber,
  headerSheetRowNumber,
  hitDataColIndexByWidths,
  hitEmptySheetColIndex,
  isEmptySheetRowIndex,
  sheetHeaderBandRows,
  sheetRowNumber
} from "../components/pivot/PivotTable/sheetBuffer";

describe("sheetBuffer", () => {
  it("exposes a 50×50 empty sheet buffer beyond data", () => {
    expect(EMPTY_SHEET_COLS).toBe(50);
    expect(EMPTY_SHEET_ROWS).toBe(50);
    expect(emptySheetBufferWidth()).toBe(50 * EMPTY_COL_WIDTH);
  });

  it("indexes empty sheet rows after data", () => {
    expect(isEmptySheetRowIndex(4, 5)).toBe(false);
    expect(isEmptySheetRowIndex(5, 5)).toBe(true);
    expect(emptySheetRowNumber(5)).toBe(6);
  });

  it("numbers field-header band then data from H+1", () => {
    expect(sheetHeaderBandRows(0)).toBe(1);
    expect(sheetHeaderBandRows(2)).toBe(2);
    expect(headerSheetRowNumber(0)).toBe(1);
    expect(sheetRowNumber(0, 1)).toBe(2);
    expect(emptySheetRowNumber(5, 1)).toBe(7);
  });

  it("builds selection keys that append empty buffer cols", () => {
    const keys = buildSelectionColumnKeys(["a", "b"], 3);
    expect(keys).toEqual(["a", "b", emptySheetColKey(0), emptySheetColKey(1), emptySheetColKey(2)]);
  });

  it("hit-tests empty buffer col from mouse x", () => {
    expect(hitEmptySheetColIndex(150, 100, 100, 10)).toBe(0);
    expect(hitEmptySheetColIndex(250, 100, 100, 10)).toBe(1);
    expect(hitEmptySheetColIndex(0, 100, 100, 10)).toBe(0);
    expect(hitEmptySheetColIndex(5000, 100, 100, 10)).toBe(9);
  });
});

describe("empty-row data col selection overlay", () => {
  it("hit-tests variable-width data cols", () => {
    expect(hitDataColIndexByWidths(105, 100, [40, 60, 80])).toBe(0);
    expect(hitDataColIndexByWidths(145, 100, [40, 60, 80])).toBe(1);
    expect(hitDataColIndexByWidths(210, 100, [40, 60, 80])).toBe(2);
  });

  it("builds continuous overlay rect for selection in data cols", () => {
    const sel = {
      anchor: { rowIndex: 2, colIndex: 1 },
      focus: { rowIndex: 2, colIndex: 5 }
    };
    // Selection continues into buffer — data overlay has left edge, no right edge.
    const overlay = dataColsSelectionOverlay(sel, 2, 4, [50, 50, 50, 50]);
    expect(overlay).toMatchObject({
      left: 50,
      width: 150,
      visual: { selected: true, left: true, right: false, top: true, bottom: true }
    });
  });

  it("returns null when selection is only in the buffer region", () => {
    const sel = {
      anchor: { rowIndex: 0, colIndex: 4 },
      focus: { rowIndex: 0, colIndex: 6 }
    };
    expect(dataColsSelectionOverlay(sel, 0, 4, [50, 50, 50, 50])).toBeNull();
  });
});

describe("computePivotColumnWidths stretchToFill:false", () => {
  it("keeps content-fitted data widths so empty buffer can fill the sheet", () => {
    const bodySamplesByKey = new Map<string, string[]>([["order_id", ["1 874", "435"]]]);
    const widths = computePivotColumnWidths({
      columnKeys: ["__row_label__", "order_id"],
      containerWidth: 1000,
      rowLabelHeader: "Группа",
      rowLabelSamples: ["ООО ISTEMTUR"],
      headerLevels: [[{ key: "order_id", label: "Заказ ID", colspan: 1, isValue: true }]],
      bodySamplesByKey,
      rowDimHasExpand: true,
      stretchToFill: false
    });

    const dataSum = widths["__row_label__"]! + widths["order_id"]!;
    expect(dataSum).toBeLessThan(1000 - ROW_GUTTER_W);
    expect(dataSum + emptySheetBufferWidth()).toBeGreaterThan(1000);
  });
});
