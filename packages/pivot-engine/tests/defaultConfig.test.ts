import { describe, expect, it } from "vitest";
import { createDefaultPivotConfig, isEmptyPivotConfig, resolvePivotConfig } from "../src/utils/defaultConfig.js";
import { DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";
import type { PivotField } from "../src/types/pivot.types.js";

const FIELDS: PivotField[] = [
  { id: "dealer", label: "Diler", dataType: "string" },
  { id: "qty", label: "Miqdor", dataType: "number" },
  { id: "amount", label: "Summa", dataType: "currency" }
];

describe("createDefaultPivotConfig", () => {
  it("birinchi string qator va birinchi sonli metrika", () => {
    const defaults = createDefaultPivotConfig(FIELDS);
    expect(defaults.rows).toEqual(["dealer"]);
    expect(defaults.values?.[0]?.fieldId).toBe("qty");
    expect(defaults.values?.[0]?.aggregation).toBe("SUM");
  });

  it("isEmptyPivotConfig", () => {
    expect(isEmptyPivotConfig(DEFAULT_PIVOT_CONFIG)).toBe(true);
    expect(
      isEmptyPivotConfig({
        ...DEFAULT_PIVOT_CONFIG,
        rows: ["dealer"]
      })
    ).toBe(false);
  });

  it("resolvePivotConfig bo'sh konfiguratsiyani to'ldiradi", () => {
    const resolved = resolvePivotConfig(DEFAULT_PIVOT_CONFIG, FIELDS);
    expect(resolved.rows).toEqual(["dealer"]);
    expect(resolved.values[0]?.fieldId).toBe("qty");
  });
});
