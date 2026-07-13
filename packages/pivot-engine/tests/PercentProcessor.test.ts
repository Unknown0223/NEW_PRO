import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency", format: { type: "currency", currency: "UZS" } }
];

const ROWS = [
  { region: "Toshkent", month: "Yan", amount: 1_000_000 },
  { region: "Toshkent", month: "Fev", amount: 500_000 },
  { region: "Samarqand", month: "Yan", amount: 2_000_000 },
  { region: "Samarqand", month: "Fev", amount: 300_000 }
];

describe("PERCENT aggregations", () => {
  const engine = new PivotEngine();

  it("PERCENT_OF_ROW — qator ichida foiz", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "PERCENT_OF_ROW" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    const yan = toshkent?.cells.find((c) => c.columnKey.includes("Yan"));
    const fev = toshkent?.cells.find((c) => c.columnKey.includes("Fev"));
    expect(yan?.rawValue).toBeCloseTo(66.67, 1);
    expect(fev?.rawValue).toBeCloseTo(33.33, 1);
    expect(yan?.formatted).toContain("%");
  });

  it("PERCENT_OF_TOTAL — umumiy jami foizi", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "PERCENT_OF_TOTAL" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    const yan = toshkent?.cells.find((c) => c.columnKey.includes("Yan"));
    // 1M / 3.8M * 100
    expect(yan?.rawValue).toBeCloseTo(26.32, 1);
  });

  it("PERCENT_OF_ROW — bitta ustun (har qator 100%)", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "PERCENT_OF_ROW" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    for (const row of result.rows) {
      const cell = row.cells.find((c) => c.columnKey === "amount");
      expect(cell?.rawValue).toBeCloseTo(100, 1);
    }
  });

  it("PERCENT_OF_COLUMN — ustun ichida foiz", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "PERCENT_OF_COLUMN" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    const samarqand = result.rows.find((r) => r.key.includes("Samarqand"));
    const tYan = toshkent?.cells.find((c) => c.columnKey.includes("Yan"));
    const sYan = samarqand?.cells.find((c) => c.columnKey.includes("Yan"));
    // Yan: 1M + 2M = 3M; Toshkent 1M/3M, Samarqand 2M/3M
    expect(tYan?.rawValue).toBeCloseTo(33.33, 1);
    expect(sYan?.rawValue).toBeCloseTo(66.67, 1);
  });
});
