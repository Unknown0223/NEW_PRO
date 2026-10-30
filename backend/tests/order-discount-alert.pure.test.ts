import { describe, expect, it } from "vitest";
import { decideDiscountAlert } from "../src/modules/orders/order-discount-alert";

describe("decideDiscountAlert", () => {
  const base = {
    discountPct: 10,
    expectedSum: 500,
    cashDeskOk: true,
    applyDiscount: true,
    bonusBlocksDiscount: false
  };

  it("no alert when discount successfully applied", () => {
    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: true,
        hasWinningRule: true
      }).alert
    ).toBeNull();
  });

  it("no alert when no matching discount rule", () => {
    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: false,
        hasWinningRule: false,
        discountPct: null,
        expectedSum: 0
      }).alert
    ).toBeNull();
  });

  it("cash_desk_missing only when rule matches", () => {
    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: false,
        hasWinningRule: true,
        cashDeskOk: false
      }).alert
    ).toBe("cash_desk_missing");

    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: false,
        hasWinningRule: false,
        cashDeskOk: false,
        discountPct: null,
        expectedSum: 0
      }).alert
    ).toBeNull();
  });

  it("not_applied when agent turned discount off but rule matches", () => {
    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: false,
        hasWinningRule: true,
        applyDiscount: false
      }).alert
    ).toBe("not_applied");
  });

  it("bonus_required when stack blocks discount", () => {
    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: false,
        hasWinningRule: true,
        bonusBlocksDiscount: true
      }).alert
    ).toBe("bonus_required");
  });

  it("not_applied when rule matches but discount sum is zero", () => {
    expect(
      decideDiscountAlert({
        ...base,
        discountApplied: false,
        hasWinningRule: true
      }).alert
    ).toBe("not_applied");
  });
});
