import { describe, expect, it } from "vitest";
import { mergeCellStyles, resolveCustomizeCellStyle } from "../src/utils/customizeCell.js";
import type { CustomizeCellFn, PivotCell, PivotConfig } from "../src/types/pivot.types.js";
import { DEFAULT_PIVOT_CONFIG } from "../src/core/PivotEngine.js";

const sampleCell: PivotCell = {
  value: 100,
  rawValue: 100,
  formatted: "100",
  columnKey: "amount",
  isEmpty: false
};

const sampleConfig: PivotConfig = { ...DEFAULT_PIVOT_CONFIG, values: [{ fieldId: "amount", aggregation: "SUM" }] };

describe("customizeCell", () => {
  it("resolveCustomizeCellStyle — callback natijasi", () => {
    const fn: CustomizeCellFn = ({ cell }) =>
      cell.rawValue === 100 ? { backgroundColor: "#fef3c7", color: "#92400e" } : undefined;
    const style = resolveCustomizeCellStyle(fn, { cell: sampleCell, config: sampleConfig });
    expect(style?.backgroundColor).toBe("#fef3c7");
  });

  it("resolveCustomizeCellStyle — undefined callback", () => {
    expect(resolveCustomizeCellStyle(undefined, { cell: sampleCell, config: sampleConfig })).toBeUndefined();
  });

  it("mergeCellStyles — customizeCell ustun", () => {
    const merged = mergeCellStyles(
      { backgroundColor: "#fee2e2", textColor: "#b91c1c" },
      { backgroundColor: "#dcfce7", color: "#166534", fontWeight: "bold" }
    );
    expect(merged.backgroundColor).toBe("#dcfce7");
    expect(merged.color).toBe("#166534");
    expect(merged.fontWeight).toBe("bold");
  });

  it("mergeCellStyles — faqat shartli format", () => {
    const merged = mergeCellStyles({ backgroundColor: "#fee2e2", textColor: "#b91c1c" });
    expect(merged.backgroundColor).toBe("#fee2e2");
    expect(merged.color).toBe("#b91c1c");
  });
});
