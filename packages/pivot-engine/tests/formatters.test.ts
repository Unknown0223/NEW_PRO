import { describe, expect, it } from "vitest";
import {
  collectCurrencyCodesFromPivot,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  formatValue,
  formatUzNumber,
  shouldShowCurrencySuffix
} from "../src/utils/formatters.js";
import type { PivotConfig, PivotField } from "../src/types/pivot.types.js";

describe("formatters", () => {
  it("formatCurrency — bitta valyutada suffix yo‘q", () => {
    const result = formatCurrency(1_500_000, { type: "currency", currency: "UZS", decimals: 0 });
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result.toLowerCase()).not.toMatch(/so.?m|uzs/);
  });

  it("formatCurrency — showCurrency=true da soʻm", () => {
    const result = formatCurrency(
      1_500_000,
      { type: "currency", currency: "UZS", decimals: 0 },
      { showCurrency: true }
    );
    expect(result.toLowerCase()).toMatch(/so.?m/);
  });

  it("formatCurrency — format.showCurrency yolg‘iz yetarli emas", () => {
    const result = formatCurrency(1_500_000, {
      type: "currency",
      currency: "UZS",
      decimals: 0,
      showCurrency: true
    });
    expect(result.toLowerCase()).not.toMatch(/so.?m|uzs/);
  });

  it("shouldShowCurrencySuffix — faqat 2+ valyutada", () => {
    const fields: PivotField[] = [
      { id: "amount", label: "Sum", dataType: "currency", format: { type: "currency", currency: "UZS" } },
      { id: "amount_usd", label: "USD", dataType: "currency", format: { type: "currency", currency: "USD" } }
    ];
    const single: PivotConfig = {
      rows: [],
      columns: [],
      values: [{ fieldId: "amount", aggregation: "SUM", format: { type: "currency", currency: "UZS" } }],
      reportFilters: [],
      filters: [],
      options: { showSubtotals: false, showGrandTotal: true, showColumnTotals: false, compactMode: false, drillDown: true }
    };
    const multi: PivotConfig = {
      ...single,
      values: [
        { fieldId: "amount", aggregation: "SUM", format: { type: "currency", currency: "UZS" } },
        { fieldId: "amount_usd", aggregation: "SUM", format: { type: "currency", currency: "USD" } }
      ]
    };
    expect(shouldShowCurrencySuffix(single, fields)).toBe(false);
    expect(shouldShowCurrencySuffix(multi, fields)).toBe(true);
    expect(collectCurrencyCodesFromPivot(multi, fields).sort()).toEqual(["USD", "UZS"]);
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

  it("formatDate — WDR yyyy MM dd HH:mm:ss", () => {
    const date = new Date(2025, 2, 7, 14, 5, 9);
    expect(formatDate(date, { type: "date", dateFormat: "yyyy MM dd HH:mm:ss" })).toBe(
      "2025 03 07 14:05:09"
    );
  });

  it("formatValue — null", () => {
    expect(formatValue(null)).toBe("—");
  });

  it("formatValue — nullDisplay", () => {
    expect(formatValue(null, { type: "number", nullDisplay: "н/д" })).toBe("н/д");
  });

  it("formatNumber — thousands/decimal/negatives", () => {
    const result = formatNumber(-1234.5, {
      type: "number",
      decimals: 1,
      thousandsSep: ",",
      decimalSep: ".",
      negativeFormat: "parens"
    });
    expect(result).toBe("(1,234.5)");
  });

  it("formatNumber — space thousands", () => {
    const result = formatNumber(1_000_000, {
      type: "number",
      decimals: 0,
      thousandsSep: "space"
    });
    expect(result.replace(/\s/g, " ")).toBe("1 000 000");
  });

  it("formatUzNumber", () => {
    expect(formatUzNumber(1000).replace(/\s/g, "")).toBe("1000");
  });
});
