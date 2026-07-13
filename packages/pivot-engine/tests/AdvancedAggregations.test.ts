import { describe, expect, it } from "vitest";
import { Aggregator } from "../src/core/Aggregator.js";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

describe("Aggregator — PRODUCT", () => {
  const aggregator = new Aggregator();

  it("ko'paytma", () => {
    expect(aggregator.aggregate([2, 3, 4], "PRODUCT")).toBe(24);
  });

  it("bo'sh massiv — null", () => {
    expect(aggregator.aggregate([], "PRODUCT")).toBeNull();
  });
});

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" }
];

const ROWS = [
  { region: "Toshkent", month: "Yan", amount: 100 },
  { region: "Toshkent", month: "Fev", amount: 200 },
  { region: "Samarqand", month: "Yan", amount: 300 },
  { region: "Samarqand", month: "Fev", amount: 400 }
];

describe("INDEX aggregation", () => {
  const engine = new PivotEngine();

  it("INDEX — (value × grand) / (row × col)", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "INDEX" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    const yan = toshkent?.cells.find((c) => c.columnKey.includes("Yan"));
    // value=100, row=300, col=400, grand=1000 → (100*1000)/(300*400) = 0.833...
    expect(yan?.rawValue).toBeCloseTo(0.833, 2);
  });
});

describe("DIFFERENCE aggregation", () => {
  const engine = new PivotEngine();

  it("DIFFERENCE — qator bo'ylab farq", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "DIFFERENCE" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    const yan = toshkent?.cells.find((c) => c.columnKey.includes("Yan"));
    const fev = toshkent?.cells.find((c) => c.columnKey.includes("Fev"));
    expect(yan?.isEmpty).toBe(true);
    expect(fev?.rawValue).toBe(100);
  });
});
