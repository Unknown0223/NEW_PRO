import { describe, expect, it } from "vitest";
import {
  applyCellFormatToConfig,
  cellFormatFromConfig,
  DEFAULT_CELL_FORMAT
} from "@/components/reports/virtual-pivot-format-dialogs";
import type { PivotConfig } from "@salec/pivot-engine";

const baseConfig: PivotConfig = {
  rows: ["dealer"],
  columns: [],
  values: [
    { fieldId: "amount", aggregation: "SUM" },
    { fieldId: "qty", aggregation: "SUM" }
  ],
  reportFilters: [],
  filters: [],
  options: {
    showSubtotals: false,
    showGrandTotal: true,
    showColumnTotals: false,
    compactMode: true,
    drillDown: true
  }
};

describe("applyCellFormatToConfig", () => {
  it("wires thousands, negatives, nullDisplay, pattern into FieldFormat", () => {
    const next = applyCellFormatToConfig(baseConfig, {
      ...DEFAULT_CELL_FORMAT,
      thousands: ",",
      decimalSep: ".",
      decimalPlaces: "1",
      negatives: "(1)",
      nullValue: "н/д",
      pattern: "#,##0.0",
      formatType: "number",
      asPercent: false
    });
    const fmt = next.values[0]?.format;
    expect(fmt?.thousandsSep).toBe(",");
    expect(fmt?.decimalSep).toBe(".");
    expect(fmt?.decimals).toBe(1);
    expect(fmt?.negativeFormat).toBe("parens");
    expect(fmt?.nullDisplay).toBe("н/д");
    expect(fmt?.numberPattern).toBe("#,##0.0");
    expect(fmt?.type).toBe("number");
  });

  it("supports currency type", () => {
    const next = applyCellFormatToConfig(baseConfig, {
      ...DEFAULT_CELL_FORMAT,
      formatType: "currency",
      currency: "USD",
      asPercent: false
    });
    expect(next.values[0]?.format?.type).toBe("currency");
    expect(next.values[0]?.format?.currency).toBe("USD");
  });

  it("valueScope=selected applies only to one field", () => {
    const next = applyCellFormatToConfig(baseConfig, {
      ...DEFAULT_CELL_FORMAT,
      valueScope: "selected",
      selectedFieldId: "qty",
      asPercent: true,
      formatType: "percent"
    });
    expect(next.values.find((v) => v.fieldId === "qty")?.format?.type).toBe("percent");
    expect(next.values.find((v) => v.fieldId === "amount")?.format).toBeUndefined();
  });

  it("cellFormatFromConfig round-trips separators", () => {
    const withFmt = applyCellFormatToConfig(baseConfig, {
      ...DEFAULT_CELL_FORMAT,
      thousands: ".",
      decimalSep: ",",
      negatives: "(1)",
      nullValue: "-"
    });
    const partial = cellFormatFromConfig(withFmt);
    expect(partial.thousands).toBe(".");
    expect(partial.decimalSep).toBe(",");
    expect(partial.negatives).toBe("(1)");
    expect(partial.nullValue).toBe("-");
  });
});
