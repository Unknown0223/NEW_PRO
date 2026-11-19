/**
 * ADR-008 M1.2: OrderCreateBonusDebt pure (debt/split).
 */
import { describe, expect, it } from "vitest";
import {
  computeDebtAmounts,
  computePolkiLineDebt,
  capPolkiExplicitSplit,
  parseDiscountDebtAmount
} from "../components/orders/order-create/bonus-debt/bonus-debt.logic";
import type { PolkiPairRowModel } from "../components/orders/order-create/types";

function row(partial: Partial<PolkiPairRowModel> = {}): PolkiPairRowModel {
  return {
    pair_key: "1-1",
    order_id: 1,
    order_number: "O1",
    product_id: 1,
    name: "Test",
    sku: "SKU",
    unit: "dona",
    max_paid: 5,
    max_bonus: 2,
    unit_price_paid: 1000,
    unit_price_bonus: 500,
    category_id: 1,
    volume_m3: null,
    ...partial
  };
}

describe("computeDebtAmounts", () => {
  it("ordinary → 0", () => {
    expect(computeDebtAmounts({ kind: "ordinary" })).toEqual({
      debtHintSum: 0,
      bonusDebt: 0
    });
  });

  it("polki auto-bonus debt", () => {
    expect(
      computeDebtAmounts({
        kind: "polki",
        useAutoBonus: true,
        autoBonusDebtAmount: 1500,
        rows: [],
        polkiTotalQty: {},
        polkiBonusToBalance: {},
        polkiBonusCash: {}
      })
    ).toEqual({ debtHintSum: 1500, bonusDebt: 1500 });
  });

  it("polki manual — defer-to-balance debt via computePolkiLineDebt", () => {
    const r = row();
    const amounts = computeDebtAmounts({
      kind: "polki",
      useAutoBonus: false,
      rows: [r],
      polkiTotalQty: { "1-1": "7" },
      polkiBonusToBalance: { "1-1": true },
      polkiBonusCash: { "1-1": "0" }
    });
    const line = computePolkiLineDebt({
      row: r,
      totalQty: 7,
      deferToBalance: true,
      cashRaw: "0"
    });
    expect(amounts.debtHintSum).toBe(line);
    expect(amounts.bonusDebt).toBe(Math.round(line));
    expect(amounts.debtHintSum).toBeGreaterThan(0);
  });
});

describe("capPolkiExplicitSplit (via BonusDebt surface)", () => {
  it("caps paid+bonus to return qty (slack → paid)", () => {
    expect(capPolkiExplicitSplit(row({ max_paid: 5, max_bonus: 2 }), 3, 5, 2)).toEqual({
      paid: 3,
      bonus: 0
    });
  });
});

describe("parseDiscountDebtAmount", () => {
  it("parses positive amounts", () => {
    expect(parseDiscountDebtAmount("1 200.5")).toBe(1200.5);
    expect(parseDiscountDebtAmount("0")).toBe(0);
    expect(parseDiscountDebtAmount(null)).toBe(0);
  });
});
