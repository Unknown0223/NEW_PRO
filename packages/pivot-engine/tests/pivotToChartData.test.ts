import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_MAX_CATEGORIES,
  CHART_LARGE_DATASET_THRESHOLD,
  getChartWarnings,
  hasChartableData,
  pivotChartDataToRechartsRows,
  pivotToChartData
} from "../src/chart/pivotToChartData.js";
import type { PivotData, PivotRow } from "../src/types/pivot.types.js";

const SAMPLE: PivotData = {
  headers: [
    [
      { key: "__row_label__", label: "Группа", colspan: 1, rowspan: 1, depth: 0, isValue: false },
      { key: "amount", label: "Summa", colspan: 1, rowspan: 1, depth: 0, isValue: true }
    ]
  ],
  rows: [
    {
      key: "Toshkent",
      depth: 0,
      cells: [
        { value: "Toshkent", rawValue: null, formatted: "Toshkent", columnKey: "__row_label__", isEmpty: false },
        { value: 100, rawValue: 100, formatted: "100", columnKey: "amount", isEmpty: false }
      ]
    },
    {
      key: "Samarqand",
      depth: 0,
      cells: [
        { value: "Samarqand", rawValue: null, formatted: "Samarqand", columnKey: "__row_label__", isEmpty: false },
        { value: 200, rawValue: 200, formatted: "200", columnKey: "amount", isEmpty: false }
      ]
    }
  ],
  metadata: { totalRows: 2, processedRows: 2, executionTime: 0, warnings: [] }
};

function makeRows(count: number): PivotRow[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `R${i}`,
    depth: 0,
    cells: [
      {
        value: `R${i}`,
        rawValue: null,
        formatted: `R${i}`,
        columnKey: "__row_label__",
        isEmpty: false
      },
      { value: i + 1, rawValue: i + 1, formatted: String(i + 1), columnKey: "amount", isEmpty: false }
    ]
  }));
}

describe("pivotToChartData", () => {
  it("qatorlar va seriyalar", () => {
    const chart = pivotToChartData(SAMPLE);
    expect(chart.categories).toEqual(["Toshkent", "Samarqand"]);
    expect(chart.series).toHaveLength(1);
    expect(chart.series[0]?.data).toEqual([100, 200]);
    expect(chart.meta.truncated).toBe(false);
    expect(chart.meta.totalCategories).toBe(2);
  });

  it("kategoriyalarni cheklaydi", () => {
    const data: PivotData = {
      ...SAMPLE,
      rows: makeRows(CHART_DEFAULT_MAX_CATEGORIES + 5)
    };
    const chart = pivotToChartData(data);
    expect(chart.categories).toHaveLength(CHART_DEFAULT_MAX_CATEGORIES);
    expect(chart.meta.truncated).toBe(true);
    expect(chart.meta.totalCategories).toBe(CHART_DEFAULT_MAX_CATEGORIES + 5);
  });

  it("pivotChartDataToRechartsRows", () => {
    const chart = pivotToChartData(SAMPLE);
    const rows = pivotChartDataToRechartsRows(chart);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ category: "Toshkent", amount: 100 });
  });

  it("hasChartableData", () => {
    expect(hasChartableData(pivotToChartData(SAMPLE))).toBe(true);
    expect(hasChartableData({ categories: [], series: [], meta: { totalCategories: 0, shownCategories: 0, truncated: false, maxCategories: 24 } })).toBe(false);
  });

  it("getChartWarnings — truncation va katta dataset", () => {
    const truncatedData: PivotData = { ...SAMPLE, rows: makeRows(30) };
    const truncatedChart = pivotToChartData(truncatedData);
    const truncationWarnings = getChartWarnings(truncatedData, truncatedChart);
    expect(truncationWarnings.some((w) => w.includes("30"))).toBe(true);

    const largeMeta = {
      ...SAMPLE.metadata,
      processedRows: CHART_LARGE_DATASET_THRESHOLD
    };
    const largeWarnings = getChartWarnings(
      { ...SAMPLE, metadata: largeMeta },
      pivotToChartData(SAMPLE),
      CHART_LARGE_DATASET_THRESHOLD
    );
    expect(largeWarnings.some((w) => w.includes("50"))).toBe(true);
  });
});

