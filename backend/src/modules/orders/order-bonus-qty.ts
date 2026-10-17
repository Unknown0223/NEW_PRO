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
  bonusRoomAfterPaidQty,
  ruleBlockedByOncePerClient,
  ruleHasPurchaseScope,
  ruleMatchesClient,
  ruleMatchesConsignment,
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
import { bonusGiftSelectionMeta, resolveCategoryGiftCandidateIds } from "./bonus-gift-selection";
import {
  rewardRuleViews,
  ruleOrAnyClauseUsesCalendarMonth
} from "./order-bonus-clauses";
import { scopedQtyBonusSlices } from "./order-bonus-qty-slices";
export type QtyBonusPeek = {
  rule: BonusRuleRow;
  purchasedPid: number;
  giftPid: number;
  bonusQty: number;
};

/** Bir xil qoida + bir xil sovg‘a SKU — bonus miqdorini yig‘adi (har xil sovg‘a SKU alohida qoladi). */
export function mergeQtyPeeksByRule(peeks: QtyBonusPeek[]): QtyBonusPeek[] {
  const key = (p: QtyBonusPeek) => `${p.rule.id}:${p.giftPid}`;
  const byKey = new Map<string, QtyBonusPeek>();
  for (const p of peeks) {
    const k = key(p);
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, { ...p });
      continue;
    }
    const mergedBonusQty = prev.bonusQty + p.bonusQty;
    const keep =
      p.bonusQty > prev.bonusQty
        ? p
        : prev.bonusQty > p.bonusQty
          ? prev
          : p.purchasedPid === QTY_AGGREGATE_PURCHASED_PID
            ? p
            : prev;
    byKey.set(k, {
      rule: p.rule,
      purchasedPid: keep.purchasedPid,
      giftPid: keep.giftPid,
      bonusQty: mergedBonusQty
    });
  }
  return [...byKey.values()];
}

/**
 * Qty bonus: (1) doira **bo‘sh** — barcha pullik qatorlar yig‘indisi, eng yuqori priority qoida;
 * (2) faqat assortiment — **har SKU alohida** (6+1: 36→6, 18→3);
 * (3) kategoriya — mos SKU miqdorlari **yig‘iladi** (3+1: 1+1+1 → 1).
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

  const needsMonthQty = filtered.some((r) => ruleOrAnyClauseUsesCalendarMonth(r));
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
    for (const c of r.clauses ?? []) {
      for (const id of c.bonus_product_ids) stockProductIds.add(id);
      for (const id of c.product_ids) stockProductIds.add(id);
    }
  }
  let availableByProductId =
    engineOpts?.availableByProductId ??
    (await loadAvailableQtyByProductId(tx, tenantId, warehouseId, stockProductIds));
  /** Sovg‘a tanlash: pullik savatdan keyin qolgan joy. */
  let giftPickAvail = bonusRoomAfterPaidQty(availableByProductId, qtyByProduct);

  const peeks: QtyBonusPeek[] = [];

  let totalPaidQty = 0;
  for (const q of qtyByProduct.values()) {
    if (q > 0) totalPaidQty += q;
  }

  const orderAgentQty =
    engineOpts?.prereqEnv?.orderAgent ?? engineOpts?.orderAgent ?? null;
  const isConsignment = engineOpts?.prereqEnv?.is_consignment === true;

  for (const rule of filtered) {
    const hasClauses = (rule.clauses?.length ?? 0) > 0;
    if (!hasClauses && ruleHasPurchaseScope(rule)) continue;
    if (hasClauses) {
      // Multi-clause: host primary scope bilan skip qilmaymiz — AND tree + reward views.
      if (engineOpts?.prereqEnv) {
        if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
      } else {
        if (!ruleMatchesClient(rule, client)) continue;
        if (!ruleMatchesConsignment(rule, isConsignment)) continue;
        if (!ruleMatchesOrderAgentScope(rule, orderAgentQty)) continue;
      }
    } else {
      if (!ruleMatchesClient(rule, client)) continue;
      if (!ruleMatchesConsignment(rule, isConsignment)) continue;
      if (!ruleMatchesOrderAgentScope(rule, orderAgentQty)) continue;
      if (!ruleMatchesOrderProductScope(rule, orderedProductIds, productById)) continue;
      if (!ruleRelatesToOrderSelection(rule, orderedProductIds, productById)) continue;
      if (engineOpts?.prereqEnv) {
        if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
      }
    }

    let anyPeek = false;
    for (const view of rewardRuleViews(rule)) {
      if (ruleHasPurchaseScope(view)) continue;
      const effAgg = effectivePurchasedQtyForQtyRule(view, {
        orderQty: totalPaidQty,
        productIdForMonthLookup: null,
        monthAggregateExclOrder: monthAgg,
        monthByProductExclOrder: monthByProd
      });
      const bonusUnits = computeQtyBonusForRuleRow(view, effAgg);
      if (bonusUnits <= 0) continue;

      const ctx: QtyGiftResolveContext = { availableByProductId: giftPickAvail, minUnits: bonusUnits };

      if (view.bonus_product_ids.length === 0) {
        let heroPid = 0;
        let heroQ = 0;
        for (const [pid, q] of qtyByProduct) {
          if (q > heroQ) {
            heroQ = q;
            heroPid = pid;
          }
        }
        if (heroPid <= 0) continue;
        const giftPid = resolveQtyGiftProductId(view, heroPid, giftOverrides, ctx);
        const resolvedGift =
          giftPid > 0
            ? giftPid
            : heroPid > 0
              ? heroPid
              : view.bonus_product_ids[0] ?? 0;
        if (resolvedGift <= 0) continue;
        peeks.push({
          rule,
          purchasedPid: QTY_AGGREGATE_PURCHASED_PID,
          giftPid: resolvedGift,
          bonusQty: bonusUnits
        });
        anyPeek = true;
        continue;
      }

      const giftPid = resolveQtyGiftProductId(view, QTY_AGGREGATE_PURCHASED_PID, giftOverrides, ctx);
      const resolvedGift =
        giftPid > 0
          ? giftPid
          : view.bonus_product_ids[0] ??
            [...qtyByProduct.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
            0;
      if (resolvedGift <= 0) continue;
      peeks.push({
        rule,
        purchasedPid: QTY_AGGREGATE_PURCHASED_PID,
        giftPid: resolvedGift,
        bonusQty: bonusUnits
      });
      anyPeek = true;
    }
    if (anyPeek) break;
  }

  const scopedRules = filtered.filter((r) => {
    if ((r.clauses?.length ?? 0) > 0) {
      return rewardRuleViews(r).some((v) => ruleHasPurchaseScope(v));
    }
    return ruleHasPurchaseScope(r);
  });

  /**
   * Faqat kategoriya (aniq sovg‘a SKU yo‘q) qoidalar uchun: nomzod SKU'lar bir marta yuklanadi
   * va ularning ombor qoldig‘i (agar oldindan yuklanmagan bo‘lsa) qo‘shiladi — stock ustuvorligi
   * bilan tanlash haqiqiy qoldiqqa asoslanishi uchun.
   */
  const categoryCandidatesByKey = new Map<string, number[]>();
  const missingStockIds = new Set<number>();
  for (const rule of scopedRules) {
    for (const view of rewardRuleViews(rule)) {
      if (bonusGiftSelectionMeta(view, 0).kind !== "category_stock") continue;
      const key = `${rule.id}:${view.product_category_ids.join(",")}`;
      if (categoryCandidatesByKey.has(key)) continue;
      const ids = await resolveCategoryGiftCandidateIds(tenantId, view.product_category_ids);
      categoryCandidatesByKey.set(key, ids);
      for (const id of ids) {
        if (!availableByProductId.has(id)) missingStockIds.add(id);
      }
    }
  }
  if (missingStockIds.size > 0) {
    const extraStock = await loadAvailableQtyByProductId(tx, tenantId, warehouseId, missingStockIds);
    availableByProductId = new Map([...availableByProductId, ...extraStock]);
    giftPickAvail = bonusRoomAfterPaidQty(availableByProductId, qtyByProduct);
  }

  for (const rule of scopedRules) {
    const hasClauses = (rule.clauses?.length ?? 0) > 0;
    if (hasClauses) {
      if (engineOpts?.prereqEnv) {
        if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
      } else {
        if (!ruleMatchesClient(rule, client)) continue;
        if (!ruleMatchesConsignment(rule, isConsignment)) continue;
        if (!ruleMatchesOrderAgentScope(rule, orderAgentQty)) continue;
      }
    } else {
      if (!ruleMatchesClient(rule, client)) continue;
      if (!ruleMatchesConsignment(rule, isConsignment)) continue;
      if (!ruleMatchesOrderAgentScope(rule, orderAgentQty)) continue;
      if (!ruleMatchesOrderProductScope(rule, orderedProductIds, productById)) continue;
      if (!ruleRelatesToOrderSelection(rule, orderedProductIds, productById)) continue;
      if (engineOpts?.prereqEnv) {
        if (!(await ruleTreeSatisfiedForOrder(rule, engineOpts.prereqEnv, now, new Set()))) continue;
      }
    }

    for (const view of rewardRuleViews(rule)) {
      if (!ruleHasPurchaseScope(view)) continue;
      const slices = scopedQtyBonusSlices(view, qtyByProduct, productById, {
        monthAggregateExclOrder: monthAgg,
        monthByProductExclOrder: monthByProd
      });
      if (slices.length === 0) continue;

      const catKey = `${rule.id}:${view.product_category_ids.join(",")}`;
      const categoryCandidateIds =
        bonusGiftSelectionMeta(view, 0).kind === "category_stock"
          ? categoryCandidatesByKey.get(catKey)
          : undefined;

      for (const slice of slices) {
        const giftPid = resolveQtyGiftProductId(view, slice.purchasedPid, giftOverrides, {
          availableByProductId: giftPickAvail,
          minUnits: slice.bonusUnits,
          categoryCandidateIds
        });
        // Omborda yetmasa ham peek saqlanadi — preview/UI shart + mahsulot + yetishmovchilikni ko‘rsatadi.
        const resolvedGift =
          giftPid > 0
            ? giftPid
            : view.bonus_product_ids[0] ??
              categoryCandidateIds?.[0] ??
              (slice.purchasedPid > 0 ? slice.purchasedPid : 0);
        if (resolvedGift <= 0) continue;
        peeks.push({
          rule,
          purchasedPid: slice.purchasedPid,
          giftPid: resolvedGift,
          bonusQty: slice.bonusUnits
        });
      }
    }
  }

  return mergeQtyPeeksByRule(peeks);
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
    // Retail yo‘q bo‘lsa ham qator saqlanadi (web `bonus_qty` ko‘rinsin); summa 0.
    const priceStr = await getProductPrice(tenantId, giftPid, "retail");
    const price = new PrismaClient.Decimal(priceStr ?? "0");
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
 * Agent `bonus_gift_lines` jami — peek bo‘yicha hisoblangan earned dan oshmasin.
 * Ordinal: avval yuborilgan SKU tartibida to‘ldiriladi.
 */
export function capGiftSplitsToEarned(
  splits: ReadonlyMap<number, number>,
  earnedUnits: number
): Map<number, number> {
  const cap = Math.max(0, Math.floor(earnedUnits));
  const out = new Map<number, number>();
  if (cap <= 0) return out;
  let left = cap;
  for (const [pid, raw] of splits) {
    if (left <= 0) break;
    const q = Math.floor(Number(raw));
    if (!Number.isFinite(q) || q <= 0 || pid <= 0) continue;
    const take = Math.min(q, left);
    if (take <= 0) continue;
    out.set(pid, take);
    left -= take;
  }
  return out;
}

/** Agent tanlagan sovg‘a taqsimoti (qoida → mahsulot → dona). */
export async function materializeGiftSplits(
  tenantId: number,
  splits: ReadonlyMap<number, number>
): Promise<BonusLineDraft[]> {
  const out: BonusLineDraft[] = [];
  for (const [giftPid, units] of splits) {
    if (units <= 0) continue;
    const qty = new PrismaClient.Decimal(units);
    const priceStr = await getProductPrice(tenantId, giftPid, "retail");
    const price = new PrismaClient.Decimal(priceStr ?? "0");
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



