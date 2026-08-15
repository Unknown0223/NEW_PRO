import { describe, expect, it } from "vitest";
import type { BonusRuleRow } from "../src/modules/bonus-rules/bonus-rules.service";
import {
  buildQtyEligibleRowsFromPeeks,
  dedupeEligibleBonusRows,
  filterEligibleBonusesForPreview,
  type EligibleBonusRow
} from "../src/modules/mobile/mobile-order-bonus-preview.compute";
import type { QtyBonusPeek } from "../src/modules/orders/order-bonus-qty";

function row(
  ruleId: number,
  bonusQty: number,
  giftProductId = ruleId * 10
): EligibleBonusRow {
  return {
    rule_id: ruleId,
    name: `Rule ${ruleId}`,
    type: "qty",
    bonus_qty: bonusQty,
    max_bonus_qty: bonusQty,
    prerequisite_rule_ids: [],
    default_gift_product_id: giftProductId,
    gift_selection_kind: "single",
    allow_gift_swap: false,
    step_qty: null,
    bonus_step_qty: null,
    trigger_product_ids: [],
    gift_products: [
      {
        product_id: giftProductId,
        name: `Gift ${giftProductId}`,
        category_name: null,
        stock_available: 5,
        purchased_qty: 0,
        bonus_qty: bonusQty
      }
    ]
  };
}

describe("dedupeEligibleBonusRows", () => {
  it("bir xil rule_id bo'lsa bonus_qty va gift_products birlashtiradi", () => {
    const rows = [row(1, 2, 10), row(1, 3, 11)];
    const result = dedupeEligibleBonusRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.bonus_qty).toBe(5);
    expect(result[0]!.gift_products.map((g) => g.product_id).sort()).toEqual([10, 11]);
  });

  it("bir xil rule_id assortiment: har SKU bonus_qty yig‘indisi saqlanadi", () => {
    const rows: EligibleBonusRow[] = [
      {
        ...row(5, 7, 1),
        gift_products: [
          {
            product_id: 1,
            name: "Mahsulot 1",
            category_name: null,
            stock_available: 77,
            purchased_qty: 23,
            bonus_qty: 7
          }
        ]
      },
      {
        ...row(5, 11, 2),
        gift_products: [
          {
            product_id: 2,
            name: "Mahsulot 2",
            category_name: null,
            stock_available: 68,
            purchased_qty: 32,
            bonus_qty: 11
          }
        ]
      }
    ];
    const result = dedupeEligibleBonusRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.bonus_qty).toBe(18);
    const byPid = new Map(result[0]!.gift_products.map((g) => [g.product_id, g.bonus_qty]));
    expect(byPid.get(1)).toBe(7);
    expect(byPid.get(2)).toBe(11);
  });
});

function qtyRule(over: Partial<BonusRuleRow> = {}): BonusRuleRow {
  return {
    id: 5,
    tenant_id: 1,
    name: "5+1",
    type: "qty",
    buy_qty: null,
    free_qty: null,
    min_sum: null,
    sum_threshold_scope: "order",
    discount_pct: null,
    priority: 1,
    in_blocks: true,
    is_active: true,
    is_manual: false,
    valid_from: null,
    valid_to: null,
    client_category: null,
    price_type: null,
    payment_method: null,
    once_per_client: false,
    product_ids: [1, 2],
    product_category_ids: [],
    bonus_product_ids: [],
    scope_restrict_assortment: true,
    scope_restrict_category: false,
    prerequisite_rule_ids: [],
    conditions: [{ id: 1, min_qty: null, max_qty: null, step_qty: 5, bonus_qty: 1, max_bonus_qty: null, sort_order: 0 }],
    ...over
  } as BonusRuleRow;
}

describe("buildQtyEligibleRowsFromPeeks", () => {
  it("5+1 assortiment: M1=23→4, M2=32→6 (har SKU alohida)", () => {
    const rule = qtyRule();
    const peeks: QtyBonusPeek[] = [
      { rule, purchasedPid: 1, giftPid: 1, bonusQty: 4 },
      { rule, purchasedPid: 2, giftPid: 2, bonusQty: 6 }
    ];
    const productMap = new Map([
      [1, { id: 1, name: "Mahsulot 1", category: null }],
      [2, { id: 2, name: "Mahsulot 2", category: null }]
    ]);
    const available = new Map<number, number>([
      [1, 100],
      [2, 100]
    ]);
    const qtyByProduct = new Map<number, number>([
      [1, 23],
      [2, 32]
    ]);

    const rows = buildQtyEligibleRowsFromPeeks(peeks, productMap, available, qtyByProduct);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.bonus_qty).toBe(10);
    expect(rows[0]!.step_qty).toBe(5);
    expect(rows[0]!.bonus_step_qty).toBe(1);
    expect(rows[0]!.gift_selection_kind).toBe("assortment_auto");
    const byPid = new Map(rows[0]!.gift_products.map((g) => [g.product_id, g.bonus_qty]));
    expect(byPid.get(1)).toBe(4);
    expect(byPid.get(2)).toBe(6);
    const purchased = new Map(rows[0]!.gift_products.map((g) => [g.product_id, g.purchased_qty]));
    expect(purchased.get(1)).toBe(23);
    expect(purchased.get(2)).toBe(32);
  });

  it("pick_product: bonus_product_ids peekdan tashqari ham gift_products ga kiradi", () => {
    const rule = qtyRule({
      product_ids: [1],
      bonus_product_ids: [101, 102],
      product_category_ids: [5],
      scope_restrict_assortment: false,
      scope_restrict_category: true
    });
    const peeks: QtyBonusPeek[] = [{ rule, purchasedPid: 1, giftPid: 101, bonusQty: 2 }];
    const productMap = new Map([
      [1, { id: 1, name: "Trigger", category: null }],
      [101, { id: 101, name: "Gift A", category: null }],
      [102, { id: 102, name: "Gift B", category: null }]
    ]);
    const available = new Map<number, number>([
      [1, 50],
      [101, 20],
      [102, 30]
    ]);
    const qtyByProduct = new Map<number, number>([[1, 10]]);

    const rows = buildQtyEligibleRowsFromPeeks(peeks, productMap, available, qtyByProduct);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.gift_selection_kind).toBe("pick_product");
    expect(rows[0]!.allow_gift_swap).toBe(true);
    expect(rows[0]!.gift_products.map((g) => g.product_id).sort()).toEqual([101, 102]);
  });

  it("category_stock: allowedGiftsByRuleId to‘liq havzani beradi va swap yoqadi", () => {
    const rule = qtyRule({
      product_ids: [],
      bonus_product_ids: [],
      product_category_ids: [5],
      scope_restrict_assortment: false,
      scope_restrict_category: true
    });
    const peeks: QtyBonusPeek[] = [{ rule, purchasedPid: 1, giftPid: 201, bonusQty: 3 }];
    const productMap = new Map([
      [201, { id: 201, name: "Cat A", category: { name: "Cat" } }],
      [202, { id: 202, name: "Cat B", category: { name: "Cat" } }],
      [203, { id: 203, name: "Cat C", category: { name: "Cat" } }]
    ]);
    const available = new Map<number, number>([
      [201, 40],
      [202, 10],
      [203, 5]
    ]);
    const qtyByProduct = new Map<number, number>([[1, 15]]);
    const allowed = new Map<number, number[]>([[rule.id, [201, 202, 203]]]);

    const rows = buildQtyEligibleRowsFromPeeks(
      peeks,
      productMap,
      available,
      qtyByProduct,
      allowed
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.gift_selection_kind).toBe("category_stock");
    expect(rows[0]!.allow_gift_swap).toBe(true);
    expect(rows[0]!.gift_products.map((g) => g.product_id).sort()).toEqual([201, 202, 203]);
  });
});

describe("filterEligibleBonusesForPreview", () => {
  it("stack mode all bo'lsa barcha eligible qatorlarni qaytaradi", () => {
    const rows = [row(5, 17), row(2, 4)];
    const out = filterEligibleBonusesForPreview(
      rows,
      { mode: "all", maxUnits: null, forbidApplyAllEligible: false },
      [5, 2]
    );
    expect(out.map((r) => r.rule_id)).toEqual([5, 2]);
  });

  it("first_only rejimida applied tartibidagi birinchi eligible qatorni oladi", () => {
    const rows = [row(5, 17), row(2, 4)];
    const out = filterEligibleBonusesForPreview(
      rows,
      { mode: "first_only", maxUnits: null, forbidApplyAllEligible: false },
      [5, 2]
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.rule_id).toBe(5);
  });

  it("bonus_qty 0 bo'lgan qatorlarni chiqarib tashlaydi", () => {
    const rows = [row(1, 0), row(2, 3)];
    const out = filterEligibleBonusesForPreview(
      rows,
      { mode: "all", maxUnits: null, forbidApplyAllEligible: false },
      []
    );
    expect(out.map((r) => r.rule_id)).toEqual([2]);
  });
});
