import { describe, expect, it } from "vitest";
import { compileFormula, evaluateFormula } from "../src/utils/formulaEvaluator.js";

describe("formulaEvaluator", () => {
  const fields = ["amount", "qty", "price"];

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

  it("qavs bilan ifoda", () => {
    const fn = compileFormula("(amount + qty) * 0.05", fields);
    expect(fn({ amount: 100, qty: 100 })).toBe(10);
  });

  it("daraja ^", () => {
    const fn = compileFormula("qty ^ 2", fields);
    expect(fn({ qty: 5 })).toBe(25);
    expect(compileFormula("2 ^ 3 ^ 2", fields)({})).toBe(512);
  });

  it("taqqoslash 0/1 qaytaradi", () => {
    expect(evaluateFormula("amount > qty", { amount: 10, qty: 5 }, fields)).toBe(1);
    expect(evaluateFormula("amount < qty", { amount: 10, qty: 5 }, fields)).toBe(0);
    expect(evaluateFormula("amount = qty", { amount: 5, qty: 5 }, fields)).toBe(1);
    expect(evaluateFormula("amount != qty", { amount: 5, qty: 6 }, fields)).toBe(1);
    expect(evaluateFormula("amount <> qty", { amount: 5, qty: 5 }, fields)).toBe(0);
    expect(evaluateFormula("amount <= qty", { amount: 5, qty: 5 }, fields)).toBe(1);
    expect(evaluateFormula("amount >= qty", { amount: 6, qty: 5 }, fields)).toBe(1);
    expect(evaluateFormula("amount ≠ qty", { amount: 1, qty: 2 }, fields)).toBe(1);
    expect(evaluateFormula("amount ≤ qty", { amount: 3, qty: 3 }, fields)).toBe(1);
    expect(evaluateFormula("amount ≥ qty", { amount: 4, qty: 3 }, fields)).toBe(1);
  });

  it("AND / OR (nonzero = true)", () => {
    expect(evaluateFormula("1 AND 0", {}, fields)).toBe(0);
    expect(evaluateFormula("1 AND 2", {}, fields)).toBe(1);
    expect(evaluateFormula("0 OR 0", {}, fields)).toBe(0);
    expect(evaluateFormula("0 OR 5", {}, fields)).toBe(1);
    expect(
      evaluateFormula("amount > 0 AND qty > 0", { amount: 10, qty: 0 }, fields)
    ).toBe(0);
  });

  it("IF / ABS / MIN / MAX", () => {
    expect(evaluateFormula("IF(amount > 100, 1, 0)", { amount: 150 }, fields)).toBe(1);
    expect(evaluateFormula("IF(amount > 100, 1, 0)", { amount: 50 }, fields)).toBe(0);
    expect(evaluateFormula("ABS(0 - qty)", { qty: 7 }, fields)).toBe(7);
    expect(evaluateFormula("MIN(amount, qty, price)", { amount: 9, qty: 3, price: 5 }, fields)).toBe(
      3
    );
    expect(evaluateFormula("MAX(amount, qty)", { amount: 9, qty: 3 }, fields)).toBe(9);
  });

  it("unar minus", () => {
    expect(evaluateFormula("-amount + 10", { amount: 3 }, fields)).toBe(7);
  });

  it("ruxsat etilmagan maydon — xato", () => {
    expect(() => compileFormula("hack + amount", fields)).toThrow(/Недопустимое поле/);
  });

  it("bo'sh formula — xato", () => {
    expect(() => compileFormula("  ", fields)).toThrow(/Формула пуста/);
  });
});
