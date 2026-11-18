import { describe, expect, it } from "vitest";
import {
  addMetrics,
  emptyMetric,
  monthKey,
  monthLabel,
  quarterLabel,
  signedQtyFactor,
  yearSummaryLabel,
  yoyRatio
} from "../src/modules/reports/p1.pure";

describe("p1.pure", () => {
  it("monthKey pads month", () => {
    expect(monthKey(2026, 1)).toBe("2026-01");
    expect(monthKey(2026, 11)).toBe("2026-11");
  });

  it("labels use full year (2025/2026), not '25/'26", () => {
    expect(monthLabel(2025, 2)).toBe("Фев 2025");
    expect(monthLabel(2026, 2)).toBe("Фев 2026");
    expect(quarterLabel(2025, 1)).toBe("1 кв. 2025");
    expect(yearSummaryLabel(2026)).toBe("Итого 2026");
  });

  it("signedQtyFactor: sales +, returns and returned status -", () => {
    expect(signedQtyFactor("order", "delivered")).toBe(1);
    expect(signedQtyFactor("return", "delivered")).toBe(-1);
    expect(signedQtyFactor("return_by_order", "delivered")).toBe(-1);
    expect(signedQtyFactor("partial_return", "delivered")).toBe(-1);
    expect(signedQtyFactor("order", "returned")).toBe(-1);
  });

  it("yoyRatio and addMetrics", () => {
    expect(yoyRatio(120, 100)).toBeCloseTo(0.2);
    expect(yoyRatio(50, 0)).toBeNull();
    expect(addMetrics(emptyMetric(), { akb: 2, qty: "3", total: "10" })).toEqual({
      akb: 2,
      qty: "3",
      total: "10"
    });
  });
});
