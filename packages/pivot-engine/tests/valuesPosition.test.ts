import { describe, expect, it } from "vitest";
import { resolveValuesPosition, valuesOnRows, isWdrMeasuresFieldId } from "../src/utils/valuesPosition.js";
import { DEFAULT_PIVOT_OPTIONS } from "../src/core/defaults.js";
import { wdrSliceToPivotConfig } from "../src/adapters/wdr-slice-adapter.js";

describe("valuesPosition", () => {
  it("default — columns", () => {
    expect(resolveValuesPosition(DEFAULT_PIVOT_OPTIONS)).toBe("columns");
    expect(resolveValuesPosition(undefined)).toBe("columns");
    expect(valuesOnRows(DEFAULT_PIVOT_OPTIONS)).toBe(false);
  });

  it("rows flag", () => {
    expect(resolveValuesPosition({ ...DEFAULT_PIVOT_OPTIONS, valuesPosition: "rows" })).toBe("rows");
    expect(valuesOnRows({ ...DEFAULT_PIVOT_OPTIONS, valuesPosition: "rows" })).toBe(true);
  });

  it("isWdrMeasuresFieldId", () => {
    expect(isWdrMeasuresFieldId("Measures")).toBe(true);
    expect(isWdrMeasuresFieldId("measures")).toBe(true);
    expect(isWdrMeasuresFieldId("__values__")).toBe(true);
    expect(isWdrMeasuresFieldId("amount")).toBe(false);
  });

  it("WDR slice Measures in rows → valuesPosition rows", () => {
    const config = wdrSliceToPivotConfig({
      rows: [{ uniqueName: "region" }, { uniqueName: "Measures" }],
      columns: [{ uniqueName: "month" }],
      measures: [
        { uniqueName: "amount", aggregation: "sum" },
        { uniqueName: "qty", aggregation: "sum" }
      ]
    });
    expect(config.rows).toEqual(["region"]);
    expect(config.columns).toEqual(["month"]);
    expect(config.options.valuesPosition).toBe("rows");
  });

  it("WDR slice Measures in columns → valuesPosition columns", () => {
    const config = wdrSliceToPivotConfig({
      rows: [{ uniqueName: "region" }],
      columns: [{ uniqueName: "Measures" }],
      measures: [{ uniqueName: "amount", aggregation: "sum" }]
    });
    expect(config.columns).toEqual([]);
    expect(config.options.valuesPosition).toBe("columns");
  });

  it("WDR slice without Measures token — defaults columns", () => {
    const config = wdrSliceToPivotConfig({
      rows: [{ uniqueName: "region" }],
      columns: [{ uniqueName: "month" }],
      measures: [{ uniqueName: "amount", aggregation: "sum" }]
    });
    expect(config.options.valuesPosition).toBe("columns");
  });
});
