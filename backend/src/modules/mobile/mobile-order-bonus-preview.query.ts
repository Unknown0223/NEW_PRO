import { Prisma } from "@prisma/client";
import type { BonusRuleRow } from "../bonus-rules/bonus-rules.service";
import { ruleTreeSatisfiedForOrder } from "../orders/order-bonus-apply";
import {
  effectiveSubtotalForSumMinRule,
  ruleBlockedByOncePerClient,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleNeedsOrderContext,
  ruleRelatesToOrderSelection,
  type OrderBonusPrereqEnv
} from "../orders/order-bonus-context";

export async function findAllEligibleDiscountRules(
  discountRulesSorted: BonusRuleRow[],
  client: { id: number; category: string | null },
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, { id: number; category_id: number | null }>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number>,
  prereqEnv: OrderBonusPrereqEnv,
  now: Date
): Promise<BonusRuleRow[]> {
  const out: BonusRuleRow[] = [];
  const orderAgent = prereqEnv.orderAgent;
  const candidates = discountRulesSorted
    .filter((r) => {
      if (r.type === "discount") {
        return !ruleNeedsOrderContext(r) && !ruleBlockedByOncePerClient(r, clientUsedAutoBonusRuleIds);
      }
      if (r.type === "sum") {
        return (
          r.min_sum != null &&
          r.discount_pct != null &&
          Number(r.discount_pct) > 0 &&
          !ruleBlockedByOncePerClient(r, clientUsedAutoBonusRuleIds)
        );
      }
      return false;
    })
    .filter((r) => ruleMatchesClient(r, client))
    .filter((r) => ruleMatchesOrderAgentScope(r, orderAgent))
    .filter((r) => ruleMatchesOrderProductScope(r, orderedProductIds, productById))
    .filter((r) => r.discount_pct != null && Number(r.discount_pct) > 0);

  for (const r of candidates) {
    if (!(await ruleTreeSatisfiedForOrder(r, prereqEnv, now, new Set()))) continue;
    if (r.type === "sum") {
      if (r.min_sum == null) continue;
      const effective = effectiveSubtotalForSumMinRule(
        r,
        prereqEnv.baseSubtotalBeforeDiscount,
        prereqEnv.clientMonthMerchandiseSubtotalExclOrder
      );
      if (effective.lt(new Prisma.Decimal(r.min_sum))) continue;
    }
    if (!ruleRelatesToOrderSelection(r, orderedProductIds, productById)) continue;
    out.push(r);
  }
  return out;
}

export type GiftProductPreview = {
  product_id: number;
  name: string;
  category_name: string | null;
  stock_available: number;
};

export function mapGiftProducts(
  giftIds: number[],
  productMap: Map<number, { id: number; name: string; category: { name: string } | null }>,
  availableByProductId: Map<number, number>,
  qtyByProduct: ReadonlyMap<number, number>
): GiftProductPreview[] {
  return giftIds.map((pid) => {
    const p = productMap.get(pid);
    const warehouseQty = availableByProductId.get(pid) ?? 0;
    const orderedQty = qtyByProduct.get(pid) ?? 0;
    return {
      product_id: pid,
      name: p?.name ?? `#${pid}`,
      category_name: p?.category?.name ?? null,
      stock_available: Math.max(0, warehouseQty - orderedQty)
    };
  });
}
