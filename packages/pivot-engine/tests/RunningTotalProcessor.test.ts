import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency", format: { type: "currency", currency: "UZS" } }
];

const ROWS = [
  { region: "Toshkent", month: "Yan", amount: 100 },
  { region: "Toshkent", month: "Fev", amount: 200 },
  { region: "Samarqand", month: "Yan", amount: 300 },
  { region: "Samarqand", month: "Fev", amount: 400 }
];

describe("RUNNING_TOTAL aggregation", () => {
  const engine = new PivotEngine();

  it("bitta ustunda yig'indiy jami", () => {
    const flatRows = [
      { line: "A", amount: 100 },
      { line: "B", amount: 200 },
      { line: "C", amount: 300 },
      { line: "D", amount: 400 }
    ];
    const flatFields: PivotField[] = [
      { id: "line", label: "Qator", dataType: "string" },
      { id: "amount", label: "Summa", dataType: "currency" }
    ];
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["line"],
      values: [{ fieldId: "amount", aggregation: "RUNNING_TOTAL" }]
    };
    const result = engine.compute(flatRows, flatFields, config);
    const values = result.rows.map(
      (r) => r.cells.find((c) => c.columnKey === "amount")?.rawValue
    );
    expect(values).toEqual([100, 300, 600, 1000]);
  });

  it("guruhlangan qatorlarda yig'indiy jami", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "RUNNING_TOTAL" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const values = result.rows.map(
      (r) => r.cells.find((c) => c.columnKey === "amount")?.rawValue
    );
    expect(values).toEqual([300, 1000]);
  });

  it("ko'p ustunli pivotda har ustun uchun alohida running total", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "RUNNING_TOTAL" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const toshkent = result.rows.find((r) => r.key.includes("Toshkent"));
    const yan = toshkent?.cells.find((c) => c.columnKey.includes("Yan"));
    const fev = toshkent?.cells.find((c) => c.columnKey.includes("Fev"));
    expect(yan?.rawValue).toBe(100);
    expect(fev?.rawValue).toBe(200);
  });
});
