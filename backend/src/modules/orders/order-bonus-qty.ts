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
export type QtyBonusPeek = {
  rule: BonusRuleRow;
  purchasedPid: number;
  giftPid: number;
  bonusQty: number;
};

/**
 * Qty bonus: (1) asortiment/kategoriya **bo‘sh** — zakazdagi **barcha** pullik qatorlar miqdori yig‘indisi bo‘yicha
 * **bitta** eng yuqori priority mos qoida; (2) asortiment **bor** — har SKU bo‘yicha avvalgidek.
 */
export async function findQtyBonusPeeks(
  tx: Prisma.TransactionClient,
  tenantId: number,
  client: { id: number; category: string | null },
  qtyByProduct: ReadonlyMap<number, number>,
  productById: ReadonlyMap<number, ProductLite>,
  orderedProductIds: ReadonlySet<number>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  giftOverrides: ReadonlyMap<number, number> = new Map(),
  warehouseId?: number | null,
  engineOpts?: {
    rules?: BonusRuleRow[];
    prereqEnv?: OrderBonusPrereqEnv;
    orderAgent?: OrderAgentBonusContext | null;
    availableByProductId?: Map<number, number>;
    /** `prereqEnv` bo‘lmasa, `calendar_month` qty uchun */
    calendarContext?: { referenceAt: Date; excludeOrderId?: number };
  }
): Promise<QtyBonusPeek[]> {
  const now = new Date();
  const rules =
    engineOpts?.rules ??
    (
      await tx.bonusRule.findMany({
        where: activeRuleWhere(tenantId, "qty", now),
        include: bonusRuleInclude,
        orderBy: { priority: "desc" }
      })
    ).map((r) => mapBonusRuleFull(r));

  const filtered = rules.filter(
    (r) => !ruleNeedsOrderContext(r) && !ruleBlockedByOncePerClient(r, clientUsedAutoBonusRuleIds)
  );

  const needsMonthQty = filtered.some(
    (r) => r.type === "qty" && (r.sum_threshold_scope ?? "order") === "calendar_month"
  );
  let monthAgg = 0;
  let monthByProd: ReadonlyMap<number, number> = new Map<number, number>();
  if (needsMonthQty) {
    if (engineOpts?.prereqEnv) {
      monthAgg = engineOpts.prereqEnv.clientMonthPaidQtyAggregateExclOrder;
      monthByProd = engineOpts.prereqEnv.clientMonthPaidQtyByProductExclOrder;
    } else {
      const refAt = engineOpts?.calendarContext?.referenceAt ?? new Date();
      const excl = engineOpts?.calendarContext?.excludeOrderId;
      monthAgg = await fetchClientMonthPaidQtyAggregateExclOrder(tx, {
        tenantId,
        clientId: client.id,
        referenceAt: refAt,
        excludeOrderId: excl,
        timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
      });
      monthByProd = await fetchClientMonthPaidQtyByProductExclOrder(tx, {
        tenantId,
        clientId: client.id,
        referenceAt: refAt,
        excludeOrderId: excl,
        timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
      });
    }
  }

  const stockProductIds = new Set<number>();
  for (const pid of qtyByProduct.keys()) stockProductIds.add(pid);
  for (const r of filtered) {
    for (const id of r.bonus_product_ids) stockProductIds.add(id);
  }
  const availableByProductId =
    engineOpts?.availableByProductId ??
    (await loadAvailableQtyByProductId(tx, tenantId, warehouseId, stockProductIds));

  const peeks: QtyBonusPeek[] = [];

  let totalPaidQty = 0;
  for (const q of qtyByProduct.values()) {
    if (q > 0) totalPaidQty += q;
  }

  const orderAgentQty =
    engineOpts?.prereqEnv?.orderAgent ?? engineOpts?.orderAgent ?? null;

  for (const rule of filtered) {
    if (ruleHasPurchaseScope(rule)) continue;
    if (!ruleMatchesClient(rule, client)) continue;
    if (!ruleMatchesOrderAgentScope(rule, orderAgentQty)) continue;
    if (!ruleMatchesOrderProductScope(rule, orderedProductIds, productById)) continue;

    const effAgg = effectivePurchasedQtyForQtyRule(rule, {
      orderQty: totalPaidQty,
      productIdForMonthLookup: null,
      monthAggregateExclOrder: monthAgg,
      monthByProductExclOrder: monthByProd
    });
    const bonusUnits = computeQtyBonusForRuleRow(rule, effAgg);
    if (bonusUnits <= 0) continue;

    const ctx: QtyGiftResolveContext = { availableByProductId, minUnits: bonusUnits };

    if (rule.bonus_product_ids.length === 0) {
      let heroPid = 0;
      let heroQ = 0;
      for (const [pid, q] of qtyByProduct) {
        if (q > heroQ) {
          heroQ = q;
          heroPid = pid;
        }
      }
      if (heroPid <= 0) continue;
      const giftPid = resolveQtyGiftProductId(rule, heroPid, giftOverrides, ctx);
      if (giftPid <= 0) continue;
      if (engineOpts?.prereqEnv) {
        if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
      }
      peeks.push({
        rule,
        purchasedPid: QTY_AGGREGATE_PURCHASED_PID,
        giftPid,
        bonusQty: bonusUnits
      });
      break;
    }

    const giftPid = resolveQtyGiftProductId(rule, QTY_AGGREGATE_PURCHASED_PID, giftOverrides, ctx);
    if (giftPid <= 0) continue;
    if (engineOpts?.prereqEnv) {
      if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
    }
    peeks.push({
      rule,
      purchasedPid: QTY_AGGREGATE_PURCHASED_PID,
      giftPid,
      bonusQty: bonusUnits
    });
    break;
  }

  const scopedRules = filtered.filter((r) => ruleHasPurchaseScope(r));

  for (const [purchasedPid, purchasedQty] of qtyByProduct) {
    if (purchasedQty <= 0) continue;
    const product = productById.get(purchasedPid);
    if (!product) continue;

    for (const rule of scopedRules) {
      if (!ruleMatchesClient(rule, client)) continue;
      if (!ruleMatchesOrderAgentScope(rule, orderAgentQty)) continue;
      if (!ruleMatchesProduct(rule, product)) continue;

      const effSku = effectivePurchasedQtyForQtyRule(rule, {
        orderQty: purchasedQty,
        productIdForMonthLookup: purchasedPid,
        monthAggregateExclOrder: monthAgg,
        monthByProductExclOrder: monthByProd
      });
      const bonusUnits = computeQtyBonusForRuleRow(rule, effSku);
      if (bonusUnits <= 0) continue;

      const giftPid = resolveQtyGiftProductId(rule, purchasedPid, giftOverrides, {
        availableByProductId,
        minUnits: bonusUnits
      });
      if (giftPid <= 0) continue;
      if (engineOpts?.prereqEnv) {
        if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
      }
      peeks.push({ rule, purchasedPid, giftPid, bonusQty: bonusUnits });
      break;
    }
  }

  return peeks;
}

export async function materializeQtyPeeks(
  tenantId: number,
  peeks: QtyBonusPeek[]
): Promise<BonusLineDraft[]> {
  const giftQtyByProduct = new Map<number, PrismaClient.Decimal>();
  for (const p of peeks) {
    const add = new PrismaClient.Decimal(p.bonusQty);
    const prev = giftQtyByProduct.get(p.giftPid) ?? new PrismaClient.Decimal(0);
    giftQtyByProduct.set(p.giftPid, prev.add(add));
  }

  const out: BonusLineDraft[] = [];
  for (const [giftPid, qty] of giftQtyByProduct) {
    if (qty.lte(0)) continue;
    const priceStr = await getProductPrice(tenantId, giftPid, "retail");
    if (priceStr == null) continue;
    const price = new PrismaClient.Decimal(priceStr);
    const total = roundMoney(qty.mul(price));
    out.push({
      product_id: giftPid,
      qty,
      price,
      total,
      is_bonus: true
    });
  }

  return out;
}

/**
 * Faol `qty` bonus qoidalaridan (avtomatik) zakaz uchun bonus qatorlarni hisoblaydi.
 * Har bir sotib olingan mahsulot uchun eng yuqori `priority` li mos qoidadan bittasini qo‘llaydi.
 */
export async function computeAutoQtyBonusLines(
  tx: Prisma.TransactionClient,
  tenantId: number,
  client: { id: number; category: string | null },
  qtyByProduct: ReadonlyMap<number, number>,
  productById: ReadonlyMap<number, ProductLite>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  warehouseId?: number | null
): Promise<BonusLineDraft[]> {
  const orderedProductIds = new Set(qtyByProduct.keys());
  const peeks = await findQtyBonusPeeks(
    tx,
    tenantId,
    client,
    qtyByProduct,
    productById,
    orderedProductIds,
    clientUsedAutoBonusRuleIds,
    new Map(),
    warehouseId
  );
  return materializeQtyPeeks(tenantId, peeks);
}



