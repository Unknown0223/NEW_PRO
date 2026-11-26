import { describe, expect, it } from "vitest";
import { DEFAULT_CELL_FORMAT } from "@/components/reports/virtual-pivot-format-dialogs";
import { formatCellFormatSample } from "@/lib/cell-format-sample";

describe("formatCellFormatSample", () => {
  it("shows spaced thousands and decimal places", () => {
    const s = formatCellFormatSample(
      { ...DEFAULT_CELL_FORMAT, decimalPlaces: "2", thousands: "space", decimalSep: "," },
      1234.5
    );
    expect(s).toMatch(/1 234/);
    expect(s).toMatch(/50|5/);
  });

  it("wraps negatives in parentheses when selected", () => {
    const s = formatCellFormatSample(
      { ...DEFAULT_CELL_FORMAT, negatives: "(1)", decimalPlaces: "0" },
      -12
    );
    expect(s).toBe("(12)");
  });
});
