import { describe, expect, it } from "vitest";
import { computeQtyBonusForRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.types";
import { computeReverseLineSplit, resolveReturnBonusTheoretical } from "../src/modules/returns/returns-bonus-reverse.preview";

/** Faol qty-qoida qatori (in_blocks) — `computeQtyBonusForRuleRow` bilan bir xil mexanizm. */
function qtyRuleInBlocks(stepQty = 3, bonusQty = 1): BonusRuleRow {
  return {
    id: 1,
    name: "qty step test",
    type: "qty",
    is_active: true,
    is_manual: false,
    in_blocks: true,
    buy_qty: stepQty,
    free_qty: bonusQty,
    conditions: [
      {
        id: 1,
        min_qty: null,
        max_qty: null,
        step_qty: stepQty,
        bonus_qty: bonusQty,
        max_bonus_qty: null,
        sort_order: 0
      }
    ],
    product_ids: [],
    product_category_ids: [],
    bonus_product_ids: [],
    scope_branch_codes: [],
    scope_agent_user_ids: [],
    scope_trade_direction_ids: [],
    once_per_client: false,
    valid_from: null,
    valid_to: null,
    sort_order: 0,
    min_sum: null,
    discount_pct: null,
    sum_threshold_scope: "order",
    one_plus_one_gift: false
  } as BonusRuleRow;
}

describe("computeQtyBonusForRuleRow (faol qty mexanizm, teskari miqdor)", () => {
  it("in_blocks step 3+1: 6 qaytarish → 2 bonus (formuladan)", () => {
    expect(computeQtyBonusForRuleRow(qtyRuleInBlocks(3, 1), 6)).toBe(2);
  });

  it("in_blocks step 5+1: 10 qaytarish → 2 bonus", () => {
    expect(computeQtyBonusForRuleRow(qtyRuleInBlocks(5, 1), 10)).toBe(2);
  });

  it("in_blocks: step dan kam → 0 bonus", () => {
    expect(computeQtyBonusForRuleRow(qtyRuleInBlocks(5, 1), 3)).toBe(0);
  });
});

describe("resolveReturnBonusTheoretical", () => {
  it("po zakaz: mahsulotda bonus yo‘q — qoida bonusi hisoblanmaydi", () => {
    expect(
      resolveReturnBonusTheoretical({
        scopedToOrder: true,
        returnQty: 8,
        pool: { max_paid: 8, max_bonus: 0 },
        ruleBonusFromQty: 1
      })
    ).toBe(0);
  });

  it("po zakaz: bonus bor mahsulotda 5+1 teskari — snapshot cheklovi", () => {
    expect(
      resolveReturnBonusTheoretical({
        scopedToOrder: true,
        returnQty: 8,
        pool: { max_paid: 8, max_bonus: 1 },
        ruleBonusFromQty: 1
      })
    ).toBe(1);
  });
});

describe("computeReverseLineSplit", () => {
  const rule = { id: 1, name: "qty", label: "3+1 (блок)" };

  it("allocates bonus then paid within caps", () => {
    const r = computeReverseLineSplit({
      return_qty: 6,
      max_paid: 10,
      max_bonus: 2,
      unit_price_paid: 1000,
      unit_price_bonus: 500,
      rule,
      bonus_reverseTheoretical: 2
    });
    expect(r.bonus_qty).toBe(2);
    expect(r.paid_qty).toBe(4);
    expect(r.bonus_debt_qty).toBe(0);
  });

  it("caps return_qty at max_paid + max_bonus pool", () => {
    const r = computeReverseLineSplit({
      return_qty: 20,
      max_paid: 5,
      max_bonus: 1,
      unit_price_paid: 1000,
      unit_price_bonus: 500,
      rule: null,
      bonus_reverseTheoretical: 1
    });
    expect(r.paid_qty + r.bonus_qty).toBeLessThanOrEqual(6);
    expect(r.return_qty).toBe(20);
  });

  it("creates dolg bonus when theoretical bonus exceeds available", () => {
    const r = computeReverseLineSplit({
      return_qty: 7,
      max_paid: 5,
      max_bonus: 1,
      unit_price_paid: 1000,
      unit_price_bonus: 800,
      rule,
      bonus_reverseTheoretical: 2
    });
    expect(r.bonus_qty).toBe(1);
    expect(r.paid_qty).toBe(5);
    expect(r.bonus_debt_qty).toBeGreaterThan(0);
    expect(r.bonus_debt_amount).toBeGreaterThan(0);
  });
});
