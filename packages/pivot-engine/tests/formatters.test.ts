import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatValue,
  formatUzNumber
} from "../src/utils/formatters.js";

describe("formatters", () => {
  it("formatCurrency — UZS", () => {
    const result = formatCurrency(1_500_000, { type: "currency", currency: "UZS", decimals: 0 });
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result.toLowerCase()).toMatch(/so.?m/);
  });

  it("formatPercent", () => {
    expect(formatPercent(12.345, { type: "percent", decimals: 1 })).toBe("12.3%");
  });

  it("formatNumber — uz-UZ", () => {
    const result = formatNumber(1234.5, { type: "number", decimals: 1 });
    expect(result).toContain("1");
    expect(result).toContain("234");
  });

  it("formatDate — DD.MM.YYYY", () => {
    const date = new Date(2025, 2, 7);
    expect(formatDate(date, { type: "date", dateFormat: "DD.MM.YYYY" })).toBe("07.03.2025");
  });

  it("formatValue — null", () => {
    expect(formatValue(null)).toBe("—");
  });

  it("formatUzNumber", () => {
    expect(formatUzNumber(1000).replace(/\s/g, "")).toBe("1000");
  });
});
