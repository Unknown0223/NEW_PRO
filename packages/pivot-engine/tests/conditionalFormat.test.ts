import { describe, expect, it } from "vitest";
import type { PivotCell } from "../src/types/pivot.types.js";
import { getConditionalFormatStyle } from "../src/utils/conditionalFormat.js";

describe("conditionalFormat", () => {
  const cell: PivotCell = {
    value: -500,
    rawValue: -500,
    formatted: "-500",
    columnKey: "amount",
    isEmpty: false
  };

  it("negative qoida — qizil fon", () => {
    const style = getConditionalFormatStyle(cell, [
      { type: "negative", backgroundColor: "#fee2e2", textColor: "#b91c1c" }
    ]);
    expect(style?.backgroundColor).toBe("#fee2e2");
  });

  it("gt threshold", () => {
    const positive: PivotCell = { ...cell, rawValue: 1_000_000, value: 1_000_000 };
    const style = getConditionalFormatStyle(positive, [
      { type: "gt", threshold: 500_000, backgroundColor: "#dcfce7" }
    ]);
    expect(style?.backgroundColor).toBe("#dcfce7");
  });

  it("fieldId filtri", () => {
    const other: PivotCell = { ...cell, columnKey: "qty", rawValue: -1 };
    const style = getConditionalFormatStyle(other, [
      { fieldId: "amount", type: "negative", backgroundColor: "#fee2e2" }
    ]);
    expect(style).toBeUndefined();
  });

  it("between — inkluziv min/max", () => {
    const mid: PivotCell = { ...cell, rawValue: 50, value: 50 };
    const style = getConditionalFormatStyle(mid, [
      { type: "between", threshold: 10, thresholdMax: 100, backgroundColor: "#dbeafe" }
    ]);
    expect(style?.backgroundColor).toBe("#dbeafe");

    const outside: PivotCell = { ...cell, rawValue: 5, value: 5 };
    expect(
      getConditionalFormatStyle(outside, [
        { type: "between", threshold: 10, thresholdMax: 100, backgroundColor: "#dbeafe" }
      ])
    ).toBeUndefined();
  });

  it("between — min/max tartibi almashgan", () => {
    const mid: PivotCell = { ...cell, rawValue: 50, value: 50 };
    const style = getConditionalFormatStyle(mid, [
      { type: "between", threshold: 100, thresholdMax: 10, backgroundColor: "#fef3c7" }
    ]);
    expect(style?.backgroundColor).toBe("#fef3c7");
  });
});
