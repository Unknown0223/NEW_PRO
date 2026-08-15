import { describe, expect, it } from "vitest";
import { compileFormula, evaluateFormula } from "../src/utils/formulaEvaluator.js";

describe("formulaEvaluator", () => {
  const fields = ["amount", "qty"];

  it("qo'shish: fieldA + fieldB", () => {
    const fn = compileFormula("amount + qty", fields);
    expect(fn({ amount: 100, qty: 20 })).toBe(120);
  });

  it("ko'paytirish: fieldA * 0.12", () => {
    const fn = compileFormula("amount * 0.12", fields);
    expect(fn({ amount: 1_000_000 })).toBeCloseTo(120_000);
  });

  it("bo'lish: fieldA / fieldB", () => {
    const fn = compileFormula("amount / qty", fields);
    expect(fn({ amount: 500, qty: 10 })).toBe(50);
  });

  it("nolga bo'lish — null", () => {
    expect(evaluateFormula("amount / qty", { amount: 100, qty: 0 }, fields)).toBeNull();
  });

  it("ruxsat etilmagan maydon — xato", () => {
    expect(() => compileFormula("hack + amount", fields)).toThrow(/Ruxsat etilmagan/);
  });

  it("qavs bilan ifoda", () => {
    const fn = compileFormula("(amount + qty) * 0.05", fields);
    expect(fn({ amount: 100, qty: 100 })).toBe(10);
  });
});
