import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "product", label: "Mahsulot", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency", format: { type: "currency", currency: "UZS" } },
  { id: "qty", label: "Miqdor", dataType: "number" }
];

const ROWS = [
  { region: "Toshkent", product: "A", month: "Yan", amount: 1_000_000, qty: 10 },
  { region: "Toshkent", product: "B", month: "Yan", amount: 500_000, qty: 5 },
  { region: "Toshkent", product: "A", month: "Fev", amount: 800_000, qty: 8 },
  { region: "Samarqand", product: "A", month: "Yan", amount: 2_000_000, qty: 20 },
  { region: "Samarqand", product: "C", month: "Fev", amount: 300_000, qty: 3 }
];

describe("PivotEngine", () => {
  const engine = new PivotEngine();

  it("bo'sh values — null rows", () => {
    const result = engine.compute(ROWS, FIELDS, { ...DEFAULT_PIVOT_CONFIG, values: [] });
    expect(result.rows).toHaveLength(0);
  });

  it("qator bo'yicha SUM", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.rows.length).toBe(2);
    expect(result.grandTotal).toBeDefined();
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    expect(toshkent?.cells[1]?.rawValue).toBe(2_300_000);
    expect(result.headers[0]?.[0]?.label).toBe("Hudud");
  });

  it("measure headers use field catalog labels, not raw field ids", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [
        { fieldId: "amount", aggregation: "SUM" },
        { fieldId: "qty", aggregation: "SUM" }
      ]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const measureLabels = result.headers[0]
      ?.filter((h) => h.isValue)
      .map((h) => h.label);
    expect(measureLabels).toEqual(["Summa", "Miqdor"]);
  });

  it("qator va ustun kesishmasi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.headers.length).toBeGreaterThan(0);
    expect(result.rows.length).toBe(2);
  });

  it("filter qo'llanadi (qator maydoni)", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      filters: [{ fieldId: "region", type: "include", values: ["Toshkent"] }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.rows.length).toBe(1);
    expect(result.metadata.processedRows).toBe(3);
  });

  it("reportFilters — hisobot darajasida filtr", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      reportFilters: ["product"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      filters: [{ fieldId: "product", type: "include", values: ["A"] }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.rows.length).toBe(2);
    expect(result.metadata.processedRows).toBe(3);
  });

  it("value maydon filtr qo'llanadi (header measure filter)", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      filters: [{ fieldId: "amount", type: "range", range: { min: 1_000_000 } }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.metadata.processedRows).toBeLessThan(5);
    expect(result.metadata.processedRows).toBeGreaterThan(0);
  });

  it("reportFilters bo'lmagan filtr e'tiborsiz", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      filters: [{ fieldId: "product", type: "include", values: ["A"] }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.metadata.processedRows).toBe(5);
  });

  it("drill-down bolalar qatorlari", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region", "product"],
      values: [{ fieldId: "qty", aggregation: "SUM" }],
      options: { ...DEFAULT_PIVOT_CONFIG.options, drillDown: true }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    expect(toshkent?.children?.length).toBeGreaterThan(0);
  });

  it("sortBy — qatorlar tartiblanadi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      options: {
        ...DEFAULT_PIVOT_CONFIG.options,
        sortBy: { fieldId: "region", direction: "asc" }
      }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.rows[0]?.key).toContain("Samarqand");
  });

  it("subtotal mavjud (ko'p darajali qatorlar)", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region", "product"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      options: { ...DEFAULT_PIVOT_CONFIG.options, showSubtotals: true }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const row = result.rows[0];
    expect(row?.subtotal).toBeDefined();
    expect(row?.subtotal?.cells.length).toBeGreaterThan(0);
  });

  it("showColumnTotals — ustun jami qatori", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" }],
      options: { ...DEFAULT_PIVOT_CONFIG.options, showColumnTotals: true }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    expect(result.columnTotals).toBeDefined();
    expect(result.columnTotals?.cells[0]?.formatted).toContain("Итог по столбцам");
  });

  it("calculatedMeasures — formula maydoni", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      calculatedMeasures: [{ id: "bonus", label: "Bonus", formula: "amount * 0.05" }],
      values: [{ fieldId: "bonus", aggregation: "SUM" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    expect(toshkent?.cells[1]?.rawValue).toBeCloseTo(115_000);
  });

  it("kataklarda drillContext", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const valueCell = result.rows[0]?.cells[1];
    expect(valueCell?.drillContext?.valueFieldId).toBe("amount");
  });

  it("valuesPosition columns (default) — metrikalar yonma-yon ustunlar", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [
        { fieldId: "amount", aggregation: "SUM" },
        { fieldId: "qty", aggregation: "SUM" }
      ],
      options: { ...DEFAULT_PIVOT_CONFIG.options, valuesPosition: "columns" }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const measureLabels = result.headers[0]?.filter((h) => h.isValue).map((h) => h.label);
    expect(measureLabels).toEqual(["Summa", "Miqdor"]);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    expect(toshkent?.children).toBeUndefined();
    expect(toshkent?.cells[1]?.rawValue).toBe(2_300_000);
    expect(toshkent?.cells[2]?.rawValue).toBe(23);
  });

  it("valuesPosition rows — metrikalar qator darajasi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [
        { fieldId: "amount", aggregation: "SUM" },
        { fieldId: "qty", aggregation: "SUM" }
      ],
      options: { ...DEFAULT_PIVOT_CONFIG.options, valuesPosition: "rows", drillDown: false }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const valueHeaders = result.headers[0]?.filter((h) => h.isValue);
    expect(valueHeaders?.length).toBe(1);
    expect(valueHeaders?.[0]?.label).not.toBe("Summa");

    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    expect(toshkent?.isExpanded).toBe(true);
    expect(toshkent?.children?.length).toBe(2);
    expect(toshkent?.children?.[0]?.cells[0]?.formatted).toBe("Summa");
    expect(toshkent?.children?.[0]?.cells[1]?.rawValue).toBe(2_300_000);
    expect(toshkent?.children?.[1]?.cells[0]?.formatted).toBe("Miqdor");
    expect(toshkent?.children?.[1]?.cells[1]?.rawValue).toBe(23);
  });

  it("valuesPosition rows + columns — ustunlar faqat o‘lcham, metrikalar qatorda", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [
        { fieldId: "amount", aggregation: "SUM" },
        { fieldId: "qty", aggregation: "SUM" }
      ],
      options: { ...DEFAULT_PIVOT_CONFIG.options, valuesPosition: "rows", drillDown: false }
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const leafHeaders = result.headers[result.headers.length - 1] ?? [];
    const labels = leafHeaders.filter((h) => h.key !== "__row_label__").map((h) => h.label);
    expect(labels).toContain("Yan");
    expect(labels).toContain("Fev");
    expect(labels).not.toContain("Summa");

    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    expect(toshkent?.children?.length).toBe(2);
    const amountRow = toshkent?.children?.[0];
    expect(amountRow?.cells[0]?.formatted).toBe("Summa");
    expect(amountRow?.cells.length).toBeGreaterThan(2);
  });
});
