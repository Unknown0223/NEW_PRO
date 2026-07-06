import { Prisma, Prisma as PrismaClient } from "@prisma/client";
import {
  bonusRuleInclude,
  computeQtyBonusForRuleRow,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { getProductPrice } from "../products/product-prices.service";
import {
  activeRuleWhere,
  BONUS_SUM_THRESHOLD_TIMEZONE,
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  fetchClientMonthMerchandiseSubtotalExclOrder,
  fetchClientMonthPaidQtyAggregateExclOrder,
  fetchClientMonthPaidQtyByProductExclOrder,
  loadAvailableQtyByProductId,
  QTY_AGGREGATE_PURCHASED_PID,
  resolveQtyGiftProductId,
  resolveSumRuleGiftProductId,
  ruleBlockedByOncePerClient,
  ruleMatchesProduct,
  ruleHasPurchaseScope,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleRelatesToOrderSelection,
  ruleNeedsOrderContext,
  ruleTreeSatisfiedForOrder,
  roundMoney,
  type BonusLineDraft,
  type OrderAgentBonusContext,
  type OrderBonusPrereqEnv,
  type PaidLineDraft,
  type ProductLite,
  type QtyGiftResolveContext
} from "./order-bonus-context";
export type SumBonusPeek = {
  rule: BonusRuleRow;
  giftPid: number;
  units: number;
};

/**
 * Summa qoidasining birinchi mos varianti (narx olinmaydi).
 */
export async function findWinningSumPeek(
  tx: Prisma.TransactionClient,
  tenantId: number,
  client: { id: number; category: string | null },
  baseSubtotalBeforeDiscount: PrismaClient.Decimal,
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  qtyByProduct: ReadonlyMap<number, number> = new Map(),
  engineOpts?: {
    rules?: BonusRuleRow[];
    prereqEnv?: OrderBonusPrereqEnv;
    orderAgent?: OrderAgentBonusContext | null;
    /** `prereqEnv` bo‘lmasa, oy qoidasi uchun */
    calendarMonthReferenceAt?: Date;
    excludeOrderForMonthSum?: number;
  }
): Promise<SumBonusPeek | null> {
  const now = new Date();
  const rules =
    engineOpts?.rules ??
    (
      await tx.bonusRule.findMany({
        where: activeRuleWhere(tenantId, "sum", now),
        include: bonusRuleInclude,
        orderBy: { priority: "desc" }
      })
    ).map((r) => mapBonusRuleFull(r));

  const filtered = rules.filter(
    (r) => !ruleNeedsOrderContext(r) && !ruleBlockedByOncePerClient(r, clientUsedAutoBonusRuleIds)
  );

  let monthExcl = new PrismaClient.Decimal(0);
  if (engineOpts?.prereqEnv) {
    monthExcl = engineOpts.prereqEnv.clientMonthMerchandiseSubtotalExclOrder;
  } else if (
    filtered.some((r) => r.type === "sum" && (r.sum_threshold_scope ?? "order") === "calendar_month")
  ) {
    monthExcl = await fetchClientMonthMerchandiseSubtotalExclOrder(tx, {
      tenantId,
      clientId: client.id,
      referenceAt: engineOpts?.calendarMonthReferenceAt ?? new Date(),
      excludeOrderId: engineOpts?.excludeOrderForMonthSum,
      timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
    });
  }

  const orderAgentPeek =
    engineOpts?.prereqEnv?.orderAgent ?? engineOpts?.orderAgent ?? null;

  for (const rule of filtered) {
    if (rule.min_sum == null) continue;
    if (rule.discount_pct != null && Number(rule.discount_pct) > 0) continue;
    const minSum = new PrismaClient.Decimal(rule.min_sum);
    const effective = effectiveSubtotalForSumMinRule(rule, baseSubtotalBeforeDiscount, monthExcl);
    if (effective.lt(minSum)) continue;
    if (!ruleMatchesClient(rule, client)) continue;
    if (!ruleMatchesOrderAgentScope(rule, orderAgentPeek)) continue;
    if (!ruleMatchesOrderProductScope(rule, orderedProductIds, productById)) continue;
    if (!ruleRelatesToOrderSelection(rule, orderedProductIds, productById)) continue;

    const giftPid = resolveSumRuleGiftProductId(rule, orderedProductIds, productById, qtyByProduct);
    if (giftPid == null || giftPid <= 0) continue;

    if (engineOpts?.prereqEnv) {
      if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
    }

    const units = rule.free_qty != null && rule.free_qty > 0 ? rule.free_qty : 1;
    return { rule, giftPid, units };
  }

  return null;
}

export async function buildSumBonusDraft(
  tenantId: number,
  giftPid: number,
  units: number
): Promise<BonusLineDraft[]> {
  const priceStr = await getProductPrice(tenantId, giftPid, "retail");
  if (priceStr == null) return [];

  const price = new PrismaClient.Decimal(priceStr);
  const qty = new PrismaClient.Decimal(units);
  const total = roundMoney(qty.mul(price));
  return [{ product_id: giftPid, qty, price, total, is_bonus: true }];
}

/**
 * `min_sum` dan keyin `free_qty` dona sovg‘a (chegirmadan oldingi yig‘indiga qarab).
 * `bonus_product_ids` bo‘sh bo‘lsa — zakazdagi mos qatorlardan eng ko‘p miqdorli mahsulot.
 */
export async function computeSumThresholdBonusLines(
  tx: Prisma.TransactionClient,
  tenantId: number,
  client: { id: number; category: string | null },
  baseSubtotalBeforeDiscount: PrismaClient.Decimal,
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  qtyByProduct: ReadonlyMap<number, number> = new Map(),
  calendarContext?: { referenceAt: Date; excludeOrderId?: number }
): Promise<BonusLineDraft[]> {
  const peek = await findWinningSumPeek(
    tx,
    tenantId,
    client,
    baseSubtotalBeforeDiscount,
    orderedProductIds,
    productById,
    clientUsedAutoBonusRuleIds,
    qtyByProduct,
    {
      calendarMonthReferenceAt: calendarContext?.referenceAt,
      excludeOrderForMonthSum: calendarContext?.excludeOrderId
    }
  );
  if (!peek) return [];
  return buildSumBonusDraft(tenantId, peek.giftPid, peek.units);
}
