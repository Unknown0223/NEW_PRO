import { describe, expect, it } from "vitest";
import {
  buildHeaderMatrix,
  buildPivotWorkbook,
  pivotDataToAoA
} from "../src/export/ExportExcel.js";
import type { PivotData } from "../src/types/pivot.types.js";

const SAMPLE_DATA: PivotData = {
  headers: [
    [
      {
        key: "__row_label__",
        label: "Группа",
        colspan: 1,
        rowspan: 2,
        depth: 0,
        isValue: false
      },
      {
        key: "col_0_0",
        label: "Yan",
        colspan: 1,
        rowspan: 1,
        depth: 0,
        isValue: false
      },
      {
        key: "col_0_1",
        label: "Fev",
        colspan: 1,
        rowspan: 1,
        depth: 0,
        isValue: false
      }
    ],
    [
      {
        key: "Toshkent__amount",
        label: "Summa",
        colspan: 1,
        rowspan: 1,
        depth: 1,
        isValue: true
      },
      {
        key: "Samarqand__amount",
        label: "Summa",
        colspan: 1,
        rowspan: 1,
        depth: 1,
        isValue: true
      }
    ]
  ],
  rows: [
    {
      key: "Toshkent",
      depth: 0,
      cells: [
        {
          value: "Toshkent",
          rawValue: null,
          formatted: "Toshkent",
          columnKey: "__row_label__",
          isEmpty: false
        },
        {
          value: 1_000_000,
          rawValue: 1_000_000,
          formatted: "1 000 000 so'm",
          columnKey: "Yan__amount",
          isEmpty: false
        },
        {
          value: 800_000,
          rawValue: 800_000,
          formatted: "800 000 so'm",
          columnKey: "Fev__amount",
          isEmpty: false
        }
      ]
    },
    {
      key: "Samarqand",
      depth: 0,
      cells: [
        {
          value: "Samarqand",
          rawValue: null,
          formatted: "Samarqand",
          columnKey: "__row_label__",
          isEmpty: false
        },
        {
          value: 2_000_000,
          rawValue: 2_000_000,
          formatted: "2 000 000 so'm",
          columnKey: "Yan__amount",
          isEmpty: false
        },
        {
          value: null,
          rawValue: null,
          formatted: "—",
          columnKey: "Fev__amount",
          isEmpty: true
        }
      ]
    }
  ],
  grandTotal: {
    label: "Итого",
    cells: [
      {
        value: "Итого",
        rawValue: null,
        formatted: "Итого",
        columnKey: "__row_label__",
        isEmpty: false
      },
      {
        value: 3_000_000,
        rawValue: 3_000_000,
        formatted: "3 000 000 so'm",
        columnKey: "Yan__amount",
        isEmpty: false
      },
      {
        value: 800_000,
        rawValue: 800_000,
        formatted: "800 000 so'm",
        columnKey: "Fev__amount",
        isEmpty: false
      }
    ]
  },
  metadata: {
    totalRows: 2,
    processedRows: 2,
    executionTime: 1,
    warnings: []
  }
};

describe("ExportExcel", () => {
  it("multi-level header matritsasi", () => {
    const { matrix, merges } = buildHeaderMatrix(SAMPLE_DATA);
    expect(matrix).toHaveLength(2);
    expect(matrix[0][0]).toBe("Группа");
    expect(matrix[0][1]).toBe("Yan");
    expect(merges.length).toBeGreaterThan(0);
  });

  it("grand total qatori bilan AOA", () => {
    const aoa = pivotDataToAoA(SAMPLE_DATA);
    expect(aoa).toHaveLength(2 + 2 + 1);
    expect(aoa[aoa.length - 1][0]).toBe("Итого");
    expect(aoa[aoa.length - 1][1]).toBe("3 000 000 so'm");
  });

  it("xom sonlar rejimi", () => {
    const aoa = pivotDataToAoA(SAMPLE_DATA, { useFormattedValues: false });
    const dataRow = aoa[2];
    expect(dataRow[1]).toBe(1_000_000);
  });

  it("workbook yaratiladi", () => {
    const workbook = buildPivotWorkbook(SAMPLE_DATA, { sheetName: "Test" });
    expect(workbook.SheetNames).toContain("Test");
  });
});
