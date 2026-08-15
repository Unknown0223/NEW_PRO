import { describe, expect, it } from "vitest";
import {
  getPivotTableStyle,
  hexToRgba,
  pivotSelectionAccent,
  pivotTableStyleCssVars,
  WDR_DEFAULT_TABLE_STYLE_ID
} from "../lib/pivot-table-styles";

describe("pivot table style selection tokens", () => {
  it("hexToRgba converts opaque hex to rgba", () => {
    expect(hexToRgba("#5b9bd5", 0.18)).toBe("rgba(91, 155, 213, 0.18)");
    expect(hexToRgba("#4285f4", 0.28)).toBe("rgba(66, 133, 244, 0.28)");
  });

  it("WDR default keeps classic selection blue", () => {
    const style = getPivotTableStyle(WDR_DEFAULT_TABLE_STYLE_ID);
    expect(pivotSelectionAccent(style)).toBe("#4285f4");
    const vars = pivotTableStyleCssVars(style);
    expect(vars["--pg-select-border"]).toBe("#4285f4");
    expect(vars["--pg-select-bg"]).toBe("rgba(66, 133, 244, 0.18)");
  });

  it("medium-blue selection follows header accent", () => {
    const style = getPivotTableStyle("medium-blue");
    expect(pivotSelectionAccent(style)).toBe(style.tokens.headerBg);
    const vars = pivotTableStyleCssVars(style);
    expect(vars["--pg-select-border"]).toBe(style.tokens.headerBg);
    expect(vars["--pg-select-bg"]).toBe(hexToRgba(style.tokens.headerBg, 0.18));
    expect(vars["--pg-select-focus-bg"]).toBe(hexToRgba(style.tokens.headerBg, 0.28));
    expect(vars["--pg-select-hover-bg"]).toBe(hexToRgba(style.tokens.headerBg, 0.22));
  });

  it("medium-red / dark-green use their own accents (not google blue)", () => {
    const red = getPivotTableStyle("medium-red");
    const green = getPivotTableStyle("dark-green");
    expect(pivotSelectionAccent(red)).toBe(red.tokens.headerBg);
    expect(pivotSelectionAccent(green)).toBe(green.tokens.headerBg);
    expect(pivotTableStyleCssVars(red)["--pg-select-border"]).not.toBe("#4285f4");
    expect(pivotTableStyleCssVars(green)["--pg-select-border"]).not.toBe("#4285f4");
  });

  it("light family uses flatHeaderBg accent", () => {
    const style = getPivotTableStyle("light-orange");
    expect(pivotSelectionAccent(style)).toBe(style.tokens.flatHeaderBg);
  });
});
