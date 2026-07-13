import { describe, expect, it } from "vitest";
import {
  computeDiscountClawback,
  DISCOUNT_DEBT_MOVEMENT_NOTE,
  discountDebtNoteWithReturn
} from "../src/modules/returns/returns-enhanced.discount-debt";

describe("computeDiscountClawback", () => {
  it("full revoke: balans qarzi = qolgan skidka (qaytarilgan qismni qayta undirmaydi)", () => {
    // gross 2_500_000, 1% → net 2_475_000, disc 25_000; return ~600k gross → net 594_000
    // remaining net 1_881_000 → G1=1_900_000 < min 2m → revoke
    // remaining disc = 19_000 (not full 25_000)
    const r = computeDiscountClawback({
      orderId: 44,
      orderNumber: "44",
      remainingPaidNetBefore: 2_475_000,
      thisReturnPaidNet: 594_000,
      currentDiscountSum: 25_000,
      discountPct: 1,
      minSum: 2_000_000,
      ruleName: "Скидка 1% от 2млн"
    });
    expect(r.mode).toBe("full_revoke");
    expect(Number(r.amount)).toBe(19000);
    expect(Number(r.new_discount_sum)).toBe(0);
    expect(r.note).toContain(DISCOUNT_DEBT_MOVEMENT_NOTE);
    expect(r.note).toContain("заказ #44");
    expect(r.note).toContain("отозвано полностью");
  });

  it("proportional: balans qarzi 0 (refund net), discount_sum kamayadi", () => {
    // gross 3_000_000, 1% → net 2_970_000, disc 30_000; return 500k gross → net 495_000
    // remaining gross 2_500_000 → new disc 25_000; balance debt 0
    const r = computeDiscountClawback({
      orderId: 10,
      orderNumber: "10",
      remainingPaidNetBefore: 2_970_000,
      thisReturnPaidNet: 495_000,
      currentDiscountSum: 30_000,
      discountPct: 1,
      minSum: 2_000_000,
      ruleName: "Скидка 1%"
    });
    expect(r.mode).toBe("proportional");
    expect(Number(r.amount)).toBe(0);
    expect(Number(r.new_discount_sum)).toBe(25000);
    expect(r.note).toBe("");
  });

  it("full return: qarzi 0", () => {
    const r = computeDiscountClawback({
      orderId: 1,
      orderNumber: "1",
      remainingPaidNetBefore: 900_000,
      thisReturnPaidNet: 900_000,
      currentDiscountSum: 100_000,
      discountPct: 10,
      minSum: null,
      ruleName: null
    });
    expect(r.mode).toBe("full_revoke");
    expect(Number(r.amount)).toBe(0);
    expect(Number(r.new_discount_sum)).toBe(0);
  });

  it("none when no discount", () => {
    const r = computeDiscountClawback({
      orderId: 1,
      orderNumber: "1",
      remainingPaidNetBefore: 1000,
      thisReturnPaidNet: 100,
      currentDiscountSum: 0,
      discountPct: 10,
      minSum: null,
      ruleName: null
    });
    expect(r.mode).toBe("none");
    expect(Number(r.amount)).toBe(0);
  });
});

describe("discountDebtNoteWithReturn", () => {
  it("injects VR number after label", () => {
    const n = discountDebtNoteWithReturn(
      "Долг скидка · заказ #44 · 1% · отозвано полностью · 25000.00",
      "VR-1"
    );
    expect(n.startsWith("Долг скидка · VR-1 ·")).toBe(true);
  });
});
