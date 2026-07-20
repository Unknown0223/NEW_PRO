import { describe, expect, it } from "vitest";
import {
  ROW_GUTTER_W,
  computePivotColumnWidths,
  contentWidthForText,
  distributeColumnStretch,
  measureTextWidth,
  measureTextWidthTabular
} from "../components/pivot/PivotTable/columnSizing";

describe("distributeColumnStretch", () => {
  it("returns content widths unchanged when overfull or empty available", () => {
    expect(distributeColumnStretch([120, 80], 150)).toEqual([120, 80]);
    expect(distributeColumnStretch([120, 80], 0)).toEqual([120, 80]);
  });

  it("spreads leftover equally across all data columns (2-col screenshot case)", () => {
    const fitted = [180, 60];
    const available = 1200;
    const out = distributeColumnStretch(fitted, available, "equal");
    expect(out.reduce((a, b) => a + b, 0)).toBe(available);
    expect(out[0]).toBe(180 + Math.floor((1200 - 240) / 2));
    expect(out[1]).toBe(60 + Math.ceil((1200 - 240) / 2));
    // Both grow — last alone must not absorb the abyss
    expect(out[0]! - fitted[0]!).toBeGreaterThan(100);
    expect(out[1]! - fitted[1]!).toBeGreaterThan(100);
    expect(Math.abs(out[0]! - fitted[0]! - (out[1]! - fitted[1]!))).toBeLessThanOrEqual(1);
  });

  it("supports proportional mode with remainder on last column", () => {
    const out = distributeColumnStretch([200, 100], 600, "proportional");
    expect(out.reduce((a, b) => a + b, 0)).toBe(600);
    expect(out[0]).toBe(200 + Math.floor((300 * 200) / 300));
    expect(out[1]).toBe(600 - out[0]!);
  });
});

describe("computePivotColumnWidths", () => {
  it("content-fits then fills container for 1–2 columns", () => {
    const bodySamplesByKey = new Map<string, string[]>([["order_id", ["1 874", "435"]]]);
    const widths = computePivotColumnWidths({
      columnKeys: ["__row_label__", "order_id"],
      containerWidth: 1000,
      rowLabelHeader: "Группа",
      rowLabelSamples: ["ООО ISTEMTUR", "001 APTEKA DENOV"],
      headerLevels: [[{ key: "order_id", label: "Заказ ID", colspan: 1, isValue: true }]],
      bodySamplesByKey,
      rowDimHasExpand: true
    });

    const sum = widths["__row_label__"]! + widths["order_id"]!;
    expect(sum).toBe(1000 - ROW_GUTTER_W);
    expect(widths["__row_label__"]).toBeGreaterThan(100);
    expect(widths["order_id"]).toBeGreaterThan(100);
  });

  it("does not crush columns below content when overfull", () => {
    const bodySamplesByKey = new Map<string, string[]>([
      ["a", ["XXXXXXXXXXXXXXXXXXXX"]],
      ["b", ["YYYYYYYYYYYYYYYYYYYY"]]
    ]);
    const widths = computePivotColumnWidths({
      columnKeys: ["a", "b"],
      containerWidth: 80,
      bodySamplesByKey
    });
    expect(widths.a! + widths.b!).toBeGreaterThan(80);
    expect(widths.a!).toBeGreaterThanOrEqual(50);
    expect(widths.b!).toBeGreaterThanOrEqual(50);
  });

  it("currency/tabular samples fit «soʻm» wider than header-only Сумма", () => {
    const money = "11 057 200 soʻm";
    const bodySamplesByKey = new Map<string, string[]>([["amount", [money, "491 000 soʻm"]]]);
    const widths = computePivotColumnWidths({
      columnKeys: ["__row_dim_0__", "amount"],
      containerWidth: 800,
      rowDimLabels: ["Агент"],
      rowDimSamples: [["001 DIELUX"]],
      headerLevels: [[{ key: "amount", label: "Сумма", colspan: 1, isValue: true }]],
      bodySamplesByKey,
      stretchToFill: false
    });
    const headerOnly = contentWidthForText("Сумма", { headerChrome: true });
    const moneyNeed = contentWidthForText(money, { tabularNums: true });
    expect(widths.amount!).toBeGreaterThanOrEqual(moneyNeed);
    expect(widths.amount!).toBeGreaterThan(headerOnly);
    // Tabular digits must not measure narrower than proportional for mixed digits.
    expect(measureTextWidthTabular("117")).toBeGreaterThanOrEqual(measureTextWidth("117") - 0.5);
  });

  it("many columns keep content mins and exceed container (horizontal scroll case)", () => {
    const keys = Array.from({ length: 20 }, (_, i) => `col_${i}`);
    const bodySamplesByKey = new Map<string, string[]>();
    const headerLevels = [
      keys.map((key) => ({
        key,
        label: `Header_${key}_longname`,
        colspan: 1,
        isValue: true
      }))
    ];
    for (const key of keys) {
      bodySamplesByKey.set(key, [`value_${key}_sample`]);
    }
    const containerWidth = 600;
    const widths = computePivotColumnWidths({
      columnKeys: keys,
      containerWidth,
      headerLevels,
      bodySamplesByKey
    });
    const sum = keys.reduce((acc, k) => acc + widths[k]!, 0);
    expect(sum + ROW_GUTTER_W).toBeGreaterThan(containerWidth);
    for (const key of keys) {
      expect(widths[key]!).toBeGreaterThanOrEqual(50);
      // Must not be equal-shrunk share of container (600/20 = 30)
      expect(widths[key]!).toBeGreaterThan(30);
    }
  });

  it("fits currency body samples without underestimating tabular-nums (Сумма case)", () => {
    const currency = "491 000 soʻm";
    const bodySamplesByKey = new Map<string, string[]>([["amount", [currency, "0"]]]);
    const widths = computePivotColumnWidths({
      columnKeys: ["__row_dim_0__", "amount"],
      containerWidth: 800,
      rowDimLabels: ["Код супервайзера"],
      rowDimSamples: [["001"]],
      headerLevels: [[{ key: "amount", label: "Сумма", colspan: 1, isValue: true }]],
      bodySamplesByKey,
      stretchToFill: false
    });

    // Content-fitted width must cover formatted currency + tabular-nums slack.
    const minForCurrency = contentWidthForText(currency, { tabularNums: true });
    expect(widths.amount!).toBeGreaterThanOrEqual(minForCurrency);
    // Header alone must not win over a long UZS amount.
    expect(widths.amount!).toBeGreaterThan(contentWidthForText("Сумма", { headerChrome: true }));
  });
});
