import { describe, expect, it } from "vitest";
import { PivotEngine, DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "region", label: "Hudud", dataType: "string" },
  { id: "month", label: "Oy", dataType: "string" },
  { id: "amount", label: "Summa", dataType: "currency" }
];

const ROWS = [
  { region: "Toshkent", month: "Yan", amount: 1_000_000 },
  { region: "Toshkent", month: "Fev", amount: 500_000 },
  { region: "Samarqand", month: "Yan", amount: 2_000_000 }
];

describe("drillThrough", () => {
  const engine = new PivotEngine();

  it("qator va ustun bo'yicha filtrlash", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      columns: ["month"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const result = engine.compute(ROWS, FIELDS, config);
    const cell = result.rows[0]?.cells.find((c) => c.columnKey.includes("Yan"));
    expect(cell?.drillContext).toBeDefined();

    const records = engine.getDrillThroughRecords(ROWS, FIELDS, config, {
      rowGroupKey: cell!.drillContext!.rowGroupKey,
      columnKey: cell!.columnKey,
      valueFieldId: cell!.drillContext!.valueFieldId
    });

    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.region === "Toshkent" && r.month === "Yan")).toBe(true);
  });

  it("butun jami kataki — barcha qatorlar", () => {
    const config: PivotConfig = {
      ...DEFAULT_PIVOT_CONFIG,
      rows: ["region"],
      values: [{ fieldId: "amount", aggregation: "SUM" }]
    };
    const records = PivotEngine.getDrillThroughRecords(ROWS, FIELDS, config, {
      rowGroupKey: "__all__",
      columnKey: "amount",
      valueFieldId: "amount"
    });
    expect(records).toHaveLength(3);
  });
});
