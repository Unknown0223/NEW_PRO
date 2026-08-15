import { describe, expect, it } from "vitest";
import { countPdfExportRows, pivotDataToPdfTable } from "../src/export/ExportPdf.js";
import type { PivotData } from "../src/types/pivot.types.js";

const SAMPLE: PivotData = {
  headers: [
    [
      { key: "__row_label__", label: "Группа", colspan: 1, rowspan: 1, depth: 0, isValue: false },
      { key: "amount", label: "Summa", colspan: 1, rowspan: 1, depth: 0, isValue: true }
    ]
  ],
  rows: [
    {
      key: "A",
      depth: 0,
      cells: [
        { value: "A", rawValue: null, formatted: "A", columnKey: "__row_label__", isEmpty: false },
        { value: 10, rawValue: 10, formatted: "10", columnKey: "amount", isEmpty: false }
      ]
    }
  ],
  grandTotal: {
    label: "Итого",
    cells: [
      { value: "Итого", rawValue: null, formatted: "Итого", columnKey: "__row_label__", isEmpty: false },
      { value: 10, rawValue: 10, formatted: "10", columnKey: "amount", isEmpty: false }
    ]
  },
  metadata: { totalRows: 1, processedRows: 1, executionTime: 0, warnings: [] }
};

describe("ExportPdf", () => {
  it("pivotDataToPdfTable — head va body", () => {
    const { head, body } = pivotDataToPdfTable(SAMPLE);
    expect(head).toHaveLength(1);
    expect(head[0]).toContain("Группа");
    expect(body.length).toBeGreaterThanOrEqual(2);
  });

  it("countPdfExportRows", () => {
    expect(countPdfExportRows(SAMPLE)).toBe(2);
  });
});
