import { describe, expect, it } from "vitest";
import type { PivotRow } from "@salec/pivot-engine";
import {
  buildPivotColumnKeys,
  computeSelectionStats,
  getSelectionVisual,
  selectionRangePixelRect,
  getSpanSelectionVisual,
  normalizeRange,
  parseCellNumber,
  selectionToTsv,
  type RangeSelection
} from "../components/pivot/PivotTable/selection";
import type { LocalFlatPivotRowItem } from "../lib/pivot-flatten";

function makeRow(key: string, cells: { columnKey: string; formatted: string }[]): PivotRow {
  return {
    key,
    depth: 0,
    cells: cells.map((c) => ({
      value: c.formatted,
      rawValue: null,
      formatted: c.formatted,
      columnKey: c.columnKey,
      isEmpty: false
    }))
  };
}

describe("pivot selection TSV", () => {
  it("normalizeRange order does not matter", () => {
    const sel: RangeSelection = {
      anchor: { rowIndex: 2, colIndex: 3 },
      focus: { rowIndex: 0, colIndex: 1 }
    };
    expect(normalizeRange(sel)).toEqual({ r0: 0, r1: 2, c0: 1, c1: 3 });
  });

  it("buildPivotColumnKeys includes row dims then values", () => {
    expect(buildPivotColumnKeys(["m1", "m2"], 2, true, true)).toEqual([
      "__row_dim_0__",
      "__row_dim_1__",
      "m1",
      "m2"
    ]);
    expect(buildPivotColumnKeys(["m1"], 0, true, false)).toEqual(["__row_label__", "m1"]);
  });

  it("selectionToTsv produces tab-separated rectangular grid", () => {
    const rows: LocalFlatPivotRowItem[] = [
      {
        type: "row",
        row: makeRow("A", [
          { columnKey: "__row_label__", formatted: "Alpha" },
          { columnKey: "m1", formatted: "10" },
          { columnKey: "m2", formatted: "20" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "A",
        pathLabels: ["Alpha"]
      },
      {
        type: "row",
        row: makeRow("B", [
          { columnKey: "__row_label__", formatted: "Beta" },
          { columnKey: "m1", formatted: "30" },
          { columnKey: "m2", formatted: "40" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "B",
        pathLabels: ["Beta"]
      }
    ];
    const columnKeys = ["__row_label__", "m1", "m2"];
    const sel: RangeSelection = {
      anchor: { rowIndex: 0, colIndex: 1 },
      focus: { rowIndex: 1, colIndex: 2 }
    };
    expect(
      selectionToTsv(rows, columnKeys, sel, { useRowDimColumns: false, rowFieldCount: 1 })
    ).toBe("10\t20\n30\t40");
  });

  it("selectionToTsv quotes tabs and newlines", () => {
    const rows: LocalFlatPivotRowItem[] = [
      {
        type: "row",
        row: makeRow("A", [
          { columnKey: "__row_label__", formatted: "A\tB" },
          { columnKey: "m1", formatted: "1\n2" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "A",
        pathLabels: ["A\tB"]
      }
    ];
    const tsv = selectionToTsv(
      rows,
      ["__row_label__", "m1"],
      { anchor: { rowIndex: 0, colIndex: 0 }, focus: { rowIndex: 0, colIndex: 1 } },
      { useRowDimColumns: false, rowFieldCount: 1 }
    );
    expect(tsv).toBe('"A\tB"\t"1\n2"');
  });

  it("parseCellNumber handles currency and spaces", () => {
    expect(parseCellNumber("550 000 UZS")).toBe(550000);
    expect(parseCellNumber("24 913 500 UZS")).toBe(24913500);
    expect(parseCellNumber("—")).toBeNull();
    expect(parseCellNumber("")).toBeNull();
  });

  it("computeSelectionStats sums numeric cells only", () => {
    const rows: LocalFlatPivotRowItem[] = [
      {
        type: "row",
        row: makeRow("A", [
          { columnKey: "__row_label__", formatted: "Alpha" },
          { columnKey: "m1", formatted: "10" },
          { columnKey: "m2", formatted: "20" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "A",
        pathLabels: ["Alpha"]
      },
      {
        type: "row",
        row: makeRow("B", [
          { columnKey: "__row_label__", formatted: "Beta" },
          { columnKey: "m1", formatted: "30" },
          { columnKey: "m2", formatted: "40" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "B",
        pathLabels: ["Beta"]
      }
    ];
    const stats = computeSelectionStats(
      rows,
      ["__row_label__", "m1", "m2"],
      { anchor: { rowIndex: 0, colIndex: 1 }, focus: { rowIndex: 1, colIndex: 2 } },
      { useRowDimColumns: false, rowFieldCount: 1 }
    );
    expect(stats).toEqual({ sum: 100, avg: 25, count: 4, numericCount: 4 });
  });

  it("selectionToTsv includes empty strings for buffer rows/cols", () => {
    const rows: LocalFlatPivotRowItem[] = [
      {
        type: "row",
        row: makeRow("A", [
          { columnKey: "__row_label__", formatted: "Alpha" },
          { columnKey: "m1", formatted: "10" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "A",
        pathLabels: ["Alpha"]
      }
    ];
    const columnKeys = ["__row_label__", "m1", "__sheet_empty_0__"];
    const tsv = selectionToTsv(
      rows,
      columnKeys,
      { anchor: { rowIndex: 0, colIndex: 1 }, focus: { rowIndex: 1, colIndex: 2 } },
      { useRowDimColumns: false, rowFieldCount: 1 }
    );
    expect(tsv).toBe("10\t\n\t");
  });

  it("computeSelectionStats ignores empty buffer cells", () => {
    const rows: LocalFlatPivotRowItem[] = [
      {
        type: "row",
        row: makeRow("A", [
          { columnKey: "__row_label__", formatted: "Alpha" },
          { columnKey: "m1", formatted: "10" }
        ]),
        depth: 0,
        expanded: false,
        hasChildren: false,
        rowKey: "A",
        pathLabels: ["Alpha"]
      }
    ];
    const stats = computeSelectionStats(
      rows,
      ["__row_label__", "m1", "__sheet_empty_0__"],
      { anchor: { rowIndex: 0, colIndex: 1 }, focus: { rowIndex: 1, colIndex: 2 } },
      { useRowDimColumns: false, rowFieldCount: 1 }
    );
    expect(stats).toEqual({ sum: 10, avg: 10, count: 1, numericCount: 1 });
  });

  it("getSelectionVisual draws only outer edges of the range", () => {
    const sel: RangeSelection = {
      anchor: { rowIndex: 1, colIndex: 2 },
      focus: { rowIndex: 3, colIndex: 4 }
    };
    expect(getSelectionVisual(sel, 0, 2).selected).toBe(false);
    expect(getSelectionVisual(sel, 1, 2)).toMatchObject({
      selected: true,
      top: true,
      left: true,
      bottom: false,
      right: false
    });
    expect(getSelectionVisual(sel, 2, 3)).toMatchObject({
      selected: true,
      top: false,
      bottom: false,
      left: false,
      right: false
    });
    expect(getSelectionVisual(sel, 3, 4)).toMatchObject({
      selected: true,
      top: false,
      left: false,
      bottom: true,
      right: true,
      focus: true
    });
  });

  it("getSpanSelectionVisual edges follow selection boundary not segment outer wall", () => {
    const sel: RangeSelection = {
      anchor: { rowIndex: 0, colIndex: 1 },
      focus: { rowIndex: 0, colIndex: 5 }
    };
    // Buffer-like segment [3,5] continues from data cols — no left edge.
    expect(getSpanSelectionVisual(sel, 0, 3, 5)).toMatchObject({
      selected: true,
      left: false,
      right: true,
      top: true,
      bottom: true
    });
  });

  it("selectionRangePixelRect covers the full range bbox under the header", () => {
    const sel: RangeSelection = {
      anchor: { rowIndex: 0, colIndex: 1 },
      focus: { rowIndex: 2, colIndex: 3 }
    };
    expect(
      selectionRangePixelRect(sel, {
        colWidths: [40, 50, 60, 70],
        rowHeight: 30,
        gutterWidth: 25,
        headerHeight: 55
      })
    ).toEqual({
      left: 25 + 40,
      top: 55,
      width: 50 + 60 + 70,
      height: 90
    });
  });
});
