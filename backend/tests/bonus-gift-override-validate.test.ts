import { describe, expect, it, vi, beforeEach } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";

const { findFirst } = vi.hoisted(() => ({
  findFirst: vi.fn()
}));

vi.mock("../src/config/database", () => ({
  prisma: {
    bonusRule: { findFirst },
    product: { findMany: vi.fn().mockResolvedValue([]) }
  }
}));

import { validateBonusGiftOverrides } from "../src/modules/orders/domain/order.detail-bonus";

function ruleRow(over: Partial<BonusRuleRow> = {}): BonusRuleRow & { conditions: [] } {
  return {
    id: 7,
    tenant_id: 1,
    name: "6+1",
    type: "qty",
    buy_qty: 6,
    free_qty: 1,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: null,
    priority: 10,
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
    product_ids: [101, 102],
    bonus_product_ids: [],
    product_category_ids: [],
    scope_restrict_assortment: true,
    scope_restrict_category: false,
    target_all_clients: true,
    selected_client_ids: [],
    is_manual: false,
    in_blocks: true,
    once_per_client: false,
    one_plus_one_gift: false,
    prerequisite_rule_ids: [],
    scope_branch_codes: [],
    scope_agent_user_ids: [],
    scope_trade_direction_ids: [],
    conditions: [],
    ...over
  };
}

describe("validateBonusGiftOverrides", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it("assortiment 6+1: trigger mahsulot override qabul qilinadi", async () => {
    const now = new Date();
    findFirst.mockResolvedValue({
      ...ruleRow(),
      created_at: now,
      updated_at: now,
      scope_restrict_assortment: true,
      scope_restrict_category: false,
      conditions: []
    });
    const map = await validateBonusGiftOverrides(1, [
      { bonus_rule_id: 7, bonus_product_id: 101 }
    ]);
    expect(map.get(7)).toBe(101);
  });

  it("bonus_product_ids bo‘sh va trigger emas — rad", async () => {
    const now = new Date();
    findFirst.mockResolvedValue({
      ...ruleRow({ product_ids: [101], bonus_product_ids: [] }),
      created_at: now,
      updated_at: now,
      conditions: []
    });
    await expect(
      validateBonusGiftOverrides(1, [{ bonus_rule_id: 7, bonus_product_id: 999 }])
    ).rejects.toThrow("BAD_BONUS_GIFT_OVERRIDE");
  });
});
