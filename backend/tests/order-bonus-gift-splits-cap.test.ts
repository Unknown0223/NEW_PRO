import { describe, expect, it } from "vitest";
import { capGiftSplitsToEarned } from "../src/modules/orders/order-bonus-qty";
import { scopedQtyBonusSlices } from "../src/modules/orders/order-bonus-qty-slices";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import type { ProductLite } from "../src/modules/orders/order-bonus-context.fetch";

describe("capGiftSplitsToEarned", () => {
  it("jami earned dan oshirmaydi", () => {
    const splits = new Map([
      [10, 2],
      [11, 2],
      [12, 2]
    ]);
    expect([...capGiftSplitsToEarned(splits, 3).entries()]).toEqual([
      [10, 2],
      [11, 1]
    ]);
  });

  it("earned 0 → bo‘sh", () => {
    expect(capGiftSplitsToEarned(new Map([[1, 5]]), 0).size).toBe(0);
  });
});

/** Deploy #292 / #295 savatlari — qoida snapshotiga mos kutilgan bonus. */
describe("deploy orders 292/295 expected qty", () => {
  const emptyMonth = {
    monthAggregateExclOrder: 0,
    monthByProductExclOrder: new Map<number, number>()
  };

  function yejenevka(): BonusRuleRow {
    return {
      id: 24,
      tenant_id: 1,
      name: "Yejenevka 4 + 1",
      type: "qty",
      buy_qty: 4,
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
      product_ids: [115, 116, 117, 118],
      bonus_product_ids: [],
      product_category_ids: [],
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
      scope_restrict_assortment: true,
      scope_restrict_category: false,
      consignment_mode: "all",
      conditions: [
        {
          id: 46,
          min_qty: null,
          max_qty: null,
          step_qty: 4,
          bonus_qty: 1,
          max_bonus_qty: null,
          sort_order: 0
        }
      ],
      clauses: []
    } as BonusRuleRow;
  }

  function bebelis(): BonusRuleRow {
    return {
      ...yejenevka(),
      id: 27,
      name: "Bebilis Trusik 3 + 1",
      buy_qty: 3,
      free_qty: 1,
      product_ids: [],
      bonus_product_ids: [119, 131, 132, 133, 135],
      product_category_ids: [4],
      scope_restrict_assortment: false,
      scope_restrict_category: true,
      conditions: [
        {
          id: 49,
          min_qty: null,
          max_qty: null,
          step_qty: 3,
          bonus_qty: 1,
          max_bonus_qty: null,
          sort_order: 0
        }
      ]
    } as BonusRuleRow;
  }

  it("#292: Zerelle10 → +2; Bebelis 3+3+3 kategoriya → +3 (yig‘indi)", () => {
    const products = new Map<number, ProductLite>([
      [115, { id: 115, category_id: 3 }],
      [131, { id: 131, category_id: 4 }],
      [132, { id: 132, category_id: 4 }],
      [133, { id: 133, category_id: 4 }],
      [139, { id: 139, category_id: 10 }]
    ]);
    const qty = new Map([
      [115, 10],
      [131, 3],
      [132, 3],
      [133, 3],
      [139, 12]
    ]);
    const z = scopedQtyBonusSlices(yejenevka(), qty, products, emptyMonth);
    expect(z).toEqual([{ purchasedPid: 115, purchasedQty: 10, bonusUnits: 2 }]);
    const b = scopedQtyBonusSlices(bebelis(), qty, products, emptyMonth);
    expect(b).toHaveLength(1);
    expect(b[0]!.bonusUnits).toBe(3);
    expect(b[0]!.purchasedQty).toBe(9);
  });

  it("#295: Livial15 → +3; Zerelle5 → +1 (assortiment, har SKU)", () => {
    const products = new Map<number, ProductLite>([
      [118, { id: 118, category_id: 3 }],
      [116, { id: 116, category_id: 3 }]
    ]);
    const qty = new Map([
      [118, 15],
      [116, 5]
    ]);
    const slices = scopedQtyBonusSlices(yejenevka(), qty, products, emptyMonth);
    expect(slices.map((s) => ({ pid: s.purchasedPid, b: s.bonusUnits }))).toEqual([
      { pid: 116, b: 1 },
      { pid: 118, b: 3 }
    ]);
  });
});
