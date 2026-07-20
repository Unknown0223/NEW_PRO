import { describe, expect, it } from "vitest";
import { bonusGiftSelectionMeta } from "../src/modules/orders/bonus-gift-selection";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";

function rule(over: Partial<BonusRuleRow>): BonusRuleRow {
  return {
    id: 1,
    tenant_id: 1,
    name: "t",
    type: "qty",
    buy_qty: 6,
    free_qty: 1,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: null,
    priority: 1,
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
    bonus_product_ids: [],
    product_category_ids: [],
    scope_restrict_assortment: false,
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

describe("bonusGiftSelectionMeta", () => {
  it("assortiment-only trigger — almashtirish yo‘q", () => {
    const meta = bonusGiftSelectionMeta(
      rule({ product_ids: [10, 20], product_category_ids: [], bonus_product_ids: [] }),
      2
    );
    expect(meta).toEqual({ kind: "assortment_auto", allow_gift_swap: false });
  });

  it("2+ bonus_product_ids — tanlash (swap)", () => {
    const meta = bonusGiftSelectionMeta(rule({ bonus_product_ids: [1, 2] }), 2);
    expect(meta).toEqual({ kind: "pick_product", allow_gift_swap: true });
  });

  it("faqat assortiment: trigger=bonus (eski DB) — assortiment auto", () => {
    const meta = bonusGiftSelectionMeta(
      rule({
        product_ids: [10, 20],
        product_category_ids: [],
        bonus_product_ids: [10, 20]
      }),
      2
    );
    expect(meta).toEqual({ kind: "assortment_auto", allow_gift_swap: false });
  });

  it("kategoriya + 2 bonus SKU — tanlash", () => {
    const meta = bonusGiftSelectionMeta(
      rule({
        product_ids: [10, 20],
        product_category_ids: [5],
        bonus_product_ids: [10, 20]
      }),
      2
    );
    expect(meta).toEqual({ kind: "pick_product", allow_gift_swap: true });
  });

  it("bitta bonus mahsulot — fixed", () => {
    const meta = bonusGiftSelectionMeta(rule({ bonus_product_ids: [99] }), 1);
    expect(meta).toEqual({ kind: "fixed", allow_gift_swap: false });
  });

  it("global qty (SKU/kategoriya yo‘q) — assortment_auto (1 ta sovg‘a ham)", () => {
    const meta = bonusGiftSelectionMeta(rule({ product_ids: [], bonus_product_ids: [] }), 1);
    expect(meta).toEqual({ kind: "assortment_auto", allow_gift_swap: false });
  });

  it("faqat kategoriya, aniq sovg‘a SKU yo‘q, 1 nomzod — category_stock, swap yo‘q", () => {
    const meta = bonusGiftSelectionMeta(
      rule({ product_ids: [], product_category_ids: [5], bonus_product_ids: [] }),
      1
    );
    expect(meta).toEqual({ kind: "category_stock", allow_gift_swap: false });
  });

  it("faqat kategoriya, 2+ nomzod — category_stock, swap ruxsat", () => {
    const meta = bonusGiftSelectionMeta(
      rule({ product_ids: [], product_category_ids: [5], bonus_product_ids: [] }),
      3
    );
    expect(meta).toEqual({ kind: "category_stock", allow_gift_swap: true });
  });
});
