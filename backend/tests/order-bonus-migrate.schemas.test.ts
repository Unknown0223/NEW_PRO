import { describe, expect, it } from "vitest";
import {
  bulkOrderBonusRefreshBodySchema,
  orderBonusPreviewBodySchema,
  patchOrderLinesBodySchema
} from "../src/contracts/orders.schemas";

describe("order bonus migrate schemas", () => {
  it("patchOrderLines qabul qiladi: gift_lines + strategy_selections", () => {
    const parsed = patchOrderLinesBodySchema.safeParse({
      apply_bonus: true,
      items: [{ product_id: 1, qty: 6 }],
      bonus_gift_lines: [{ bonus_rule_id: 9, product_id: 2, qty: 1 }],
      bonus_strategy_selections: [{ strategy_id: 3, rule_ids: [9, 11] }]
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.bonus_gift_lines?.[0]?.qty).toBe(1);
      expect(parsed.data.bonus_strategy_selections?.[0]?.rule_ids).toEqual([9, 11]);
    }
  });

  it("orderBonusPreview — agent_id majburiy", () => {
    const bad = orderBonusPreviewBodySchema.safeParse({
      client_id: 1,
      warehouse_id: 1,
      items: [{ product_id: 1, qty: 1 }]
    });
    expect(bad.success).toBe(false);

    const ok = orderBonusPreviewBodySchema.safeParse({
      client_id: 1,
      warehouse_id: 1,
      agent_id: 5,
      items: [{ product_id: 1, qty: 1 }],
      exclude_order_id: 100
    });
    expect(ok.success).toBe(true);
  });

  it("bulkOrderBonusRefresh — order_ids", () => {
    const ok = bulkOrderBonusRefreshBodySchema.safeParse({ order_ids: [1, 2, 2] });
    expect(ok.success).toBe(true);
    const empty = bulkOrderBonusRefreshBodySchema.safeParse({ order_ids: [] });
    expect(empty.success).toBe(false);
  });
});
