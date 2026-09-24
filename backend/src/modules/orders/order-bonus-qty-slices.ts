import { computeQtyBonusForRuleRow, type BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { effectivePurchasedQtyForQtyRule, type ProductLite } from "./order-bonus-context.fetch";
import {
  QTY_AGGREGATE_PURCHASED_PID,
  qtyRuleMatchingProductIds,
  ruleAggregatesMatchingSkuQty,
  sumMatchingOrderQtyForQtyRule
} from "./order-bonus-context.match-scope";

export type ScopedQtyBonusSlice = {
  purchasedPid: number;
  purchasedQty: number;
  bonusUnits: number;
};

/**
 * Kategoriya doirasi — bitta yig‘indi; assortiment — har mos SKU alohida.
 */
export function scopedQtyBonusSlices(
  view: BonusRuleRow,
  qtyByProduct: ReadonlyMap<number, number>,
  productById: ReadonlyMap<number, ProductLite>,
  month: {
    monthAggregateExclOrder: number;
    monthByProductExclOrder: ReadonlyMap<number, number>;
  }
): ScopedQtyBonusSlice[] {
  const matchingPids = qtyRuleMatchingProductIds(view, qtyByProduct, productById);
  if (matchingPids.length === 0) return [];

  if (ruleAggregatesMatchingSkuQty(view)) {
    const { totalQty, heroProductId } = sumMatchingOrderQtyForQtyRule(
      view,
      qtyByProduct,
      productById
    );
    if (totalQty <= 0) return [];
    const bonusUnits = computeQtyBonusForRuleRow(
      view,
      effectivePurchasedQtyForQtyRule(view, {
        orderQty: totalQty,
        productIdForMonthLookup: null,
        monthAggregateExclOrder: month.monthAggregateExclOrder,
        monthByProductExclOrder: month.monthByProductExclOrder
      })
    );
    if (bonusUnits <= 0) return [];
    return [
      {
        purchasedPid: heroProductId > 0 ? heroProductId : QTY_AGGREGATE_PURCHASED_PID,
        purchasedQty: totalQty,
        bonusUnits
      }
    ];
  }

  const out: ScopedQtyBonusSlice[] = [];
  for (const purchasedPid of matchingPids) {
    const lineQty = qtyByProduct.get(purchasedPid) ?? 0;
    if (lineQty <= 0) continue;
    const bonusUnits = computeQtyBonusForRuleRow(
      view,
      effectivePurchasedQtyForQtyRule(view, {
        orderQty: lineQty,
        productIdForMonthLookup: purchasedPid,
        monthAggregateExclOrder: month.monthAggregateExclOrder,
        monthByProductExclOrder: month.monthByProductExclOrder
      })
    );
    if (bonusUnits <= 0) continue;
    out.push({ purchasedPid, purchasedQty: lineQty, bonusUnits });
  }
  return out;
}
