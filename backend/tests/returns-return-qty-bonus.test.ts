import { describe, expect, it } from "vitest";
import { computeReturnQtyBonusForRuleRow } from "../src/modules/bonus-rules/bonus-rules.qty";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.types";

function rule5plus1(): BonusRuleRow {
  return {
    id: 1,
    name: "5+1",
    type: "qty",
    is_active: true,
    is_manual: false,
    in_blocks: true,
    buy_qty: 5,
    free_qty: 1,
    conditions: [
      {
        id: 1,
        min_qty: null,
        max_qty: null,
        step_qty: 5,
        bonus_qty: 1,
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

describe("computeReturnQtyBonusForRuleRow — teskari blok (MISOL 7–8)", () => {
  const rule = rule5plus1();

  it("4 ta qaytarish → 1 bonus", () => {
    expect(computeReturnQtyBonusForRuleRow(rule, 4)).toBe(1);
  });

  it("5 ta qaytarish → 1 bonus", () => {
    expect(computeReturnQtyBonusForRuleRow(rule, 5)).toBe(1);
  });

  it("6 ta qaytarish → 2 bonus", () => {
    expect(computeReturnQtyBonusForRuleRow(rule, 6)).toBe(2);
  });

  it("10 ta qaytarish → 2 bonus", () => {
    expect(computeReturnQtyBonusForRuleRow(rule, 10)).toBe(2);
  });

  it("3 ta qaytarish — sotuv floor 0, qaytarish ceil 1", () => {
    expect(computeReturnQtyBonusForRuleRow(rule, 3)).toBe(1);
  });
});
