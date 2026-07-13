import { describe, expect, it } from "vitest";
import {
  EXPORT_CHUNK_SIZE,
  EXPORT_LARGE_DATASET_THRESHOLD,
  countPivotExportRows,
  formatExportProgressLabel,
  getExportWarnings,
  shouldConfirmLargeExport
} from "../src/export/exportUtils.js";
import type { PivotData, PivotRow } from "../src/types/pivot.types.js";

function makeRow(key: string, children?: PivotRow[], subtotal?: PivotRow["subtotal"]): PivotRow {
  return {
    key,
    depth: 0,
    cells: [
      {
        value: key,
        rawValue: null,
        formatted: key,
        columnKey: "__row_label__",
        isEmpty: false
      }
    ],
    children,
    subtotal
  };
}

const BASE_DATA: PivotData = {
  headers: [
    [
      {
        key: "__row_label__",
        label: "Guruh",
        colspan: 1,
        rowspan: 1,
        depth: 0,
        isValue: false
      }
    ]
  ],
  rows: [makeRow("A"), makeRow("B")],
  grandTotal: {
    label: "Jami",
    cells: [
      {
        value: "Jami",
        rawValue: null,
        formatted: "Jami",
        columnKey: "__row_label__",
        isEmpty: false
      }
    ]
  },
  metadata: {
    totalRows: 2,
    processedRows: 2,
    executionTime: 0,
    warnings: []
  }
};

describe("exportUtils", () => {
  it("countPivotExportRows — grand total bilan", () => {
    expect(countPivotExportRows(BASE_DATA)).toBe(3);
  });

  it("countPivotExportRows — yoyilgan bola va subtotal", () => {
    const child = makeRow("A|1");
    const parent = makeRow("A", [child], {
      label: "A oralik",
      cells: [
        {
          value: "A oralik",
          rawValue: null,
          formatted: "A oralik",
          columnKey: "__row_label__",
          isEmpty: false
        }
      ]
    });
    const data: PivotData = { ...BASE_DATA, rows: [parent] };
    expect(countPivotExportRows(data, { expandedRows: new Set(["A"]) })).toBe(4);
  });

  it("getExportWarnings — katta manba va eksport", () => {
    const largeSource: PivotData = {
      ...BASE_DATA,
      metadata: {
        ...BASE_DATA.metadata,
        processedRows: EXPORT_LARGE_DATASET_THRESHOLD
      }
    };
    const warnings = getExportWarnings(largeSource, {
      sourceRowCount: EXPORT_LARGE_DATASET_THRESHOLD
    });
    expect(warnings.some((w) => w.includes("50"))).toBe(true);
  });

  it("shouldConfirmLargeExport — chegaradan yuqori", () => {
    const data: PivotData = {
      ...BASE_DATA,
      metadata: {
        ...BASE_DATA.metadata,
        processedRows: EXPORT_LARGE_DATASET_THRESHOLD
      }
    };
    expect(shouldConfirmLargeExport(data)).toBe(true);
    expect(shouldConfirmLargeExport(BASE_DATA)).toBe(false);
  });

  it("formatExportProgressLabel — preparing va progress", () => {
    expect(
      formatExportProgressLabel({ phase: "preparing", processedRows: 0, totalRows: 100 })
    ).toBeTruthy();
    expect(
      formatExportProgressLabel({ phase: "preparing", processedRows: 2500, totalRows: 10_000 })
    ).toContain("2");
  });

  it("EXPORT_CHUNK_SIZE — 5000", () => {
    expect(EXPORT_CHUNK_SIZE).toBe(5_000);
  });
});
