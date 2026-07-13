import { describe, expect, it } from "vitest";
import {
  dedupeEligibleBonusRows,
  filterEligibleBonusesForPreview,
  type EligibleBonusRow
} from "../src/modules/mobile/mobile-order-bonus-preview.compute";

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
    gift_products: [
      {
        product_id: giftProductId,
        name: `Gift ${giftProductId}`,
        category_name: null,
        stock_available: 5
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
