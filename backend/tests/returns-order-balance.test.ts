import { describe, expect, it } from "vitest";
import { computeQtyBonusForRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.types";
import {
  computeOrderLevelBonusToReturn,
  distributeOrderBonusReturn
} from "../src/modules/returns/returns-bonus-reverse.order-level";
import { computeOrderReturnBalance, sumOrderItemQty } from "../src/modules/returns/returns-order-balance";
import type { OrderItemSummary } from "../src/modules/returns/returns-enhanced.types";
import { buildProductReturnPools } from "../src/modules/returns/returns-bonus-reverse.pools";

function qtyRule10plus1(): BonusRuleRow {
  return {
    id: 1,
    name: "10+1",
    type: "qty",
    is_active: true,
    is_manual: false,
    in_blocks: true,
    buy_qty: 10,
    free_qty: 1,
    conditions: [
      {
        id: 1,
        min_qty: null,
        max_qty: null,
        step_qty: 10,
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

function item(
  productId: number,
  qty: number,
  isBonus: boolean,
  orderId = 9
): OrderItemSummary {
  return {
    product_id: productId,
    sku: `SKU${productId}`,
    name: `Product ${productId}`,
    unit: "шт",
    qty: String(qty),
    price: "1000",
    total: String(qty * 1000),
    is_bonus: isBonus,
    order_id: orderId,
    order_number: "9",
    category_id: null
  };
}

describe("computeOrderLevelBonusToReturn (42→30→15→0)", () => {
  const rule = qtyRule10plus1();

  it("1-qaytarish: 12 pullik → 1 bonus", () => {
    const r = computeOrderLevelBonusToReturn({
      remainingPaidBefore: 42,
      remainingBonusBefore: 4,
      paidReturnThisTime: 12,
      rule
    });
    expect(r.remainingPaidAfter).toBe(30);
    expect(r.bonusEntitledAfter).toBe(3);
    expect(r.bonusToReturn).toBe(1);
  });

  it("2-qaytarish: 15 pullik (30 qoldiq) → 2 bonus", () => {
    const r = computeOrderLevelBonusToReturn({
      remainingPaidBefore: 30,
      remainingBonusBefore: 3,
      paidReturnThisTime: 15,
      rule
    });
    expect(r.remainingPaidAfter).toBe(15);
    expect(r.bonusEntitledAfter).toBe(1);
    expect(r.bonusToReturn).toBe(2);
  });

  it("4-qaytarish: qolgan 15 pullik → 1 bonus, qoldiq 0/0", () => {
    const r = computeOrderLevelBonusToReturn({
      remainingPaidBefore: 15,
      remainingBonusBefore: 1,
      paidReturnThisTime: 15,
      rule
    });
    expect(r.remainingPaidAfter).toBe(0);
    expect(r.bonusEntitledAfter).toBe(0);
    expect(r.bonusToReturn).toBe(1);
  });
});

describe("computeOrderReturnBalance", () => {
  it("boshlangich 42/4, 12+1 qaytarilgach qoldiq 30/3", () => {
    const original = [item(1, 42, false), item(1, 4, true)];
    const remaining = [item(1, 30, false), item(1, 3, true)];
    const returns = [
      {
        order_id: 9,
        lines: [{ product_id: 1, qty: 13, paid_qty: 12, bonus_qty: 1 }]
      }
    ];
    const bal = computeOrderReturnBalance(9, original, remaining, returns);
    expect(bal.initial_paid_qty).toBe(42);
    expect(bal.initial_bonus_qty).toBe(4);
    expect(bal.remaining_paid_qty).toBe(30);
    expect(bal.remaining_bonus_qty).toBe(3);
    expect(bal.returned_paid_qty).toBe(12);
    expect(bal.returned_bonus_qty).toBe(1);
    expect(bal.fully_returned).toBe(false);
  });

  it("qoldiq 0/0 — zakaz yopildi", () => {
    const original = [item(1, 42, false), item(1, 4, true)];
    const remaining: OrderItemSummary[] = [];
    const returns = [
      {
        order_id: 9,
        lines: [{ product_id: 1, qty: 46, paid_qty: 42, bonus_qty: 4 }]
      }
    ];
    const bal = computeOrderReturnBalance(9, original, remaining, returns);
    expect(bal.fully_returned).toBe(true);
    expect(bal.remaining_paid_qty).toBe(0);
    expect(bal.remaining_bonus_qty).toBe(0);
  });
});

describe("acceptance: 42/4 bo‘lib qaytarish", () => {
  const rule = qtyRule10plus1();

  it("3-qadam: 15 qoldiqda 20 kiritish — bonus 0 (paid cap)", () => {
    const r = computeOrderLevelBonusToReturn({
      remainingPaidBefore: 15,
      remainingBonusBefore: 1,
      paidReturnThisTime: 20,
      rule
    });
    expect(r.remainingPaidAfter).toBe(0);
    expect(r.bonusToReturn).toBe(1);
  });

  it("5-qadam: qaytarilgandan keyin qoldiq 42 emas — 30", () => {
    const original = [item(1, 42, false), item(1, 4, true)];
    const remaining = [item(1, 30, false), item(1, 3, true)];
    const bal = computeOrderReturnBalance(9, original, remaining, [
      { order_id: 9, lines: [{ product_id: 1, qty: 13, paid_qty: 12, bonus_qty: 1 }] }
    ]);
    expect(bal.remaining_paid_qty).toBe(30);
    expect(bal.remaining_bonus_qty).toBe(3);
    expect(bal.initial_paid_qty).toBe(42);
    expect(bal.returned_paid_qty).toBe(12);
  });
});

describe("distributeOrderBonusReturn", () => {
  it("bonus bitta mahsulotga tushadi", () => {
    const items = [item(1, 30, false), item(1, 3, true)];
    const pools = buildProductReturnPools(items);
    const bonusIds = new Set([1]);
    const map = distributeOrderBonusReturn(2, pools, bonusIds);
    expect(map.get(1)).toBe(2);
  });
});
