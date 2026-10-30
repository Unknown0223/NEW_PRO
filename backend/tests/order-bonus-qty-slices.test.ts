import { describe, expect, it } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import { ruleAggregatesMatchingSkuQty } from "../src/modules/orders/order-bonus-context.match-scope";
import { scopedQtyBonusSlices } from "../src/modules/orders/order-bonus-qty-slices";
import type { ProductLite } from "../src/modules/orders/order-bonus-context.fetch";

function qty31(over: Partial<BonusRuleRow> = {}): BonusRuleRow {
  return {
    id: 94,
    tenant_id: 1,
    name: "Boblis Trusik 3 + 1",
    type: "qty",
    buy_qty: 3,
    free_qty: 1,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: null,
    priority: 0,
    is_active: true,
    valid_from: null,
    valid_to: null,
    created_at: "",
    updated_at: "",
    client_category: null,
    payment_type: null,
    client_type: null,
    sales_channel: null,
    price_type: null,
    product_ids: [],
    bonus_product_ids: [4, 5, 6],
    product_category_ids: [10],
    target_all_clients: true,
    selected_client_ids: [],
    is_manual: false,
    in_blocks: true,
    once_per_client: false,
    one_plus_one_gift: false,
    prerequisite_rule_ids: [],
    scope_agent_user_ids: [],
    scope_branch_codes: [],
    scope_trade_direction_ids: [],
    scope_restrict_assortment: false,
    scope_restrict_category: true,
    consignment_mode: "all",
    conditions: [
      {
        id: 1,
        min_qty: null,
        max_qty: null,
        step_qty: 3,
        bonus_qty: 1,
        max_bonus_qty: null,
        sort_order: 0
      }
    ],
    clauses: [],
    ...over
  } as BonusRuleRow;
}

const emptyMonth = {
  monthAggregateExclOrder: 0,
  monthByProductExclOrder: new Map<number, number>()
};

describe("ruleAggregatesMatchingSkuQty", () => {
  it("kategoriya — yig‘indi", () => {
    expect(ruleAggregatesMatchingSkuQty(qty31())).toBe(true);
  });

  it("faqat assortiment SKU — har biri alohida", () => {
    expect(
      ruleAggregatesMatchingSkuQty(
        qty31({
          product_ids: [1, 2],
          product_category_ids: [],
          scope_restrict_category: false,
          scope_restrict_assortment: true
        })
      )
    ).toBe(false);
  });
});

describe("scopedQtyBonusSlices", () => {
  const products = new Map<number, ProductLite>([
    [4, { id: 4, category_id: 10 }],
    [5, { id: 5, category_id: 10 }],
    [6, { id: 6, category_id: 10 }],
    [99, { id: 99, category_id: 88 }]
  ]);

  it("kategoriya 3+1: uch o‘lcham 1+1+1 → 1 bonus (zakaz 94)", () => {
    const qty = new Map([
      [4, 1],
      [5, 1],
      [6, 1]
    ]);
    const slices = scopedQtyBonusSlices(qty31(), qty, products, emptyMonth);
    expect(slices).toHaveLength(1);
    expect(slices[0]!.bonusUnits).toBe(1);
    expect(slices[0]!.purchasedQty).toBe(3);
  });

  it("kategoriya 3+1: boshqa kategoriyadagi qator yig‘indiga kirmaydi", () => {
    const qty = new Map([
      [4, 1],
      [5, 1],
      [99, 10]
    ]);
    const slices = scopedQtyBonusSlices(qty31(), qty, products, emptyMonth);
    expect(slices).toHaveLength(0);
  });

  it("assortiment 3+1: har SKU alohida — 1+1+1 → 0", () => {
    const rule = qty31({
      product_ids: [4, 5, 6],
      product_category_ids: [],
      scope_restrict_category: false,
      scope_restrict_assortment: true
    });
    const qty = new Map([
      [4, 1],
      [5, 1],
      [6, 1]
    ]);
    expect(scopedQtyBonusSlices(rule, qty, products, emptyMonth)).toEqual([]);
  });

  it("assortiment 3+1: bitta SKU 3 dona → 1", () => {
    const rule = qty31({
      product_ids: [4, 5, 6],
      product_category_ids: [],
      scope_restrict_category: false,
      scope_restrict_assortment: true
    });
    const qty = new Map([
      [4, 3],
      [5, 1],
      [6, 1]
    ]);
    const slices = scopedQtyBonusSlices(rule, qty, products, emptyMonth);
    expect(slices).toHaveLength(1);
    expect(slices[0]!.purchasedPid).toBe(4);
    expect(slices[0]!.bonusUnits).toBe(1);
  });
});
