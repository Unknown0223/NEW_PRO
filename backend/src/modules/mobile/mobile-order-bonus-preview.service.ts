import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  bonusRuleInclude,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { parseBonusStackPolicy, bonusPolicyToJson, resolveBonusSlotTakeCount } from "../orders/bonus-stack-policy";
import {
  fetchClientUsedAutoBonusRuleIds,
  findQtyBonusPeeks,
  findWinningSumPeek,
  loadAvailableQtyByProductId,
  loadDiscountRulesForOrder,
  resolveOrderBonusesForCreate,
  fetchClientMonthPaidQtyAggregateExclOrder,
  fetchClientMonthPaidQtyByProductExclOrder,
  BONUS_SUM_THRESHOLD_TIMEZONE,
  materializeQtyPeeks,
  ruleTreeSatisfiedForOrder,
  type OrderAgentBonusContext
} from "../orders/order-bonus-apply";
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
import { bonusGiftSelectionMeta, resolveAllowedGiftProductIdsForRule } from "../orders/bonus-gift-selection";
import { findWinningDiscountRuleWithPrereqs } from "../orders/order-bonus-discount";
import { calcExpectedDiscountSum } from "../orders/order-discount-alert";
import { activeRuleWhere } from "../orders/order-bonus-context.match-gifts";
import { buildCreateOrderLineData } from "../orders/domain/order.create-lines";
import type { BonusGiftOverrideInput } from "../orders/domain/order.types";
import { validateBonusGiftOverrides } from "../orders/domain/order.detail-mappers";

export type MobileBonusPreviewInput = {
  client_id: number;
  warehouse_id: number;
  price_type?: string;
  items: { product_id: number; qty: number }[];
  bonus_gift_overrides?: BonusGiftOverrideInput[];
};

async function findAllEligibleDiscountRules(
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

function rulesLinked(a: BonusRuleRow, b: BonusRuleRow): boolean {
  const aPre = a.prerequisite_rule_ids ?? [];
  const bPre = b.prerequisite_rule_ids ?? [];
  return aPre.includes(b.id) || bPre.includes(a.id);
}

async function mapGiftProducts(
  giftIds: number[],
  productMap: Map<number, { id: number; name: string; category: { name: string } | null }>,
  availableByProductId: Map<number, number>,
  qtyByProduct: ReadonlyMap<number, number>
) {
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

type EligibleBonusRow = {
  rule_id: number;
  name: string;
  type: string;
  bonus_qty: number;
  max_bonus_qty: number | null;
  prerequisite_rule_ids: number[];
  default_gift_product_id: number | null;
  gift_selection_kind: string;
  allow_gift_swap: boolean;
  gift_products: Awaited<ReturnType<typeof mapGiftProducts>>;
};

/** Mobil preview: stack siyosatiga mos barcha mos bonuslar (faqat bittasini emas). */
function filterEligibleBonusesForPreview(
  rows: EligibleBonusRow[],
  stackPolicy: ReturnType<typeof parseBonusStackPolicy>,
  appliedAutoBonusRuleIds: number[]
): EligibleBonusRow[] {
  const eligible = rows.filter((r) => r.bonus_qty > 0);
  if (eligible.length === 0) return [];

  if (stackPolicy.mode === "all") {
    return eligible;
  }

  const take = resolveBonusSlotTakeCount(eligible.length, stackPolicy);
  if (take <= 0) return [];

  const ordered: EligibleBonusRow[] = [];
  for (const id of appliedAutoBonusRuleIds) {
    const hit = eligible.find((r) => r.rule_id === id);
    if (hit && !ordered.some((x) => x.rule_id === hit.rule_id)) ordered.push(hit);
  }
  for (const r of eligible) {
    if (!ordered.some((x) => x.rule_id === r.rule_id)) ordered.push(r);
  }
  return ordered.slice(0, take);
}

function dedupeEligibleBonusRows(rows: EligibleBonusRow[]): EligibleBonusRow[] {
  const byId = new Map<number, EligibleBonusRow>();
  for (const row of rows) {
    const prev = byId.get(row.rule_id);
    if (!prev) {
      byId.set(row.rule_id, row);
      continue;
    }
    const gifts = new Map(prev.gift_products.map((g) => [g.product_id, g]));
    for (const g of row.gift_products) {
      gifts.set(g.product_id, g);
    }
    byId.set(row.rule_id, {
      ...prev,
      bonus_qty: prev.bonus_qty + row.bonus_qty,
      max_bonus_qty:
        (prev.max_bonus_qty ?? 0) + (row.max_bonus_qty ?? row.bonus_qty),
      default_gift_product_id: prev.default_gift_product_id ?? row.default_gift_product_id,
      gift_products: [...gifts.values()]
    });
  }
  return [...byId.values()];
}

export async function previewMobileOrderBonus(
  tenantId: number,
  agentUserId: number,
  input: MobileBonusPreviewInput
) {
  const client = await prisma.client.findFirst({
    where: {
      id: input.client_id,
      tenant_id: tenantId,
      merged_into_client_id: null,
      is_active: true
    },
    select: { id: true, category: true }
  });
  if (!client) throw new Error("BAD_CLIENT");

  const wh = await prisma.warehouse.findFirst({
    where: { id: input.warehouse_id, tenant_id: tenantId }
  });
  if (!wh) throw new Error("BAD_WAREHOUSE");

  const agent = await prisma.user.findFirst({
    where: { id: agentUserId, tenant_id: tenantId, is_active: true },
    select: { id: true, branch: true, trade_direction_id: true }
  });
  if (!agent) throw new Error("BAD_AGENT");

  const orderAgent: OrderAgentBonusContext = {
    userId: agent.id,
    branch: agent.branch,
    trade_direction_id: agent.trade_direction_id
  };

  const priceType = (input.price_type ?? "").trim() || "retail";
  const createInput = {
    client_id: input.client_id,
    warehouse_id: input.warehouse_id,
    agent_id: agentUserId,
    price_type: priceType,
    order_type: "order" as const,
    items: input.items
  };

  const { lineData, totalSum, qtyByProduct, productById, orderedProductIds } =
    await buildCreateOrderLineData(tenantId, createInput, "order", priceType);

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const stackPolicy = parseBonusStackPolicy(tenantRow?.settings);

  const validatedGiftOverrides =
    input.bonus_gift_overrides?.length ?
      await validateBonusGiftOverrides(tenantId, input.bonus_gift_overrides)
    : new Map<number, number>();

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const usedRuleIds = await fetchClientUsedAutoBonusRuleIds(tx, tenantId, client.id);

    const resolved = await resolveOrderBonusesForCreate(
      tx,
      tenantId,
      { id: client.id, category: client.category },
      lineData,
      totalSum,
      totalSum,
      qtyByProduct,
      productById,
      orderedProductIds,
      stackPolicy,
      usedRuleIds,
      validatedGiftOverrides,
      new Map<number, ReadonlyMap<number, number>>(),
      input.warehouse_id,
      { referenceAt: now },
      orderAgent,
      { applyDiscount: true }
    );

    const discountRules = await loadDiscountRulesForOrder(tx, tenantId);
    const sumRaw = await tx.bonusRule.findMany({
      where: activeRuleWhere(tenantId, "sum", now),
      include: bonusRuleInclude,
      orderBy: { priority: "desc" }
    });
    const sumRules = sumRaw
      .map((r) => mapBonusRuleFull(r))
      .filter((r) => r.discount_pct == null || Number(r.discount_pct) <= 0);

    const stockProductIds = new Set<number>();
    for (const pid of qtyByProduct.keys()) stockProductIds.add(pid);

    const qtyRulesRaw = await tx.bonusRule.findMany({
      where: activeRuleWhere(tenantId, "qty", now),
      include: bonusRuleInclude,
      orderBy: { priority: "desc" }
    });
    const qtyRules = qtyRulesRaw.map((r) => mapBonusRuleFull(r));
    for (const r of qtyRules) {
      for (const id of r.bonus_product_ids) stockProductIds.add(id);
      for (const id of r.product_ids) stockProductIds.add(id);
    }

    let availableByProductId = await loadAvailableQtyByProductId(
      tx,
      tenantId,
      input.warehouse_id,
      stockProductIds
    );

    const needsQtyMonth = qtyRules.some(
      (r) => (r.sum_threshold_scope ?? "order") === "calendar_month"
    );
    const [clientMonthPaidQtyAggregateExclOrder, clientMonthPaidQtyByProductExclOrder] =
      needsQtyMonth
        ? await Promise.all([
            fetchClientMonthPaidQtyAggregateExclOrder(tx, {
              tenantId,
              clientId: client.id,
              referenceAt: now,
              timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
            }),
            fetchClientMonthPaidQtyByProductExclOrder(tx, {
              tenantId,
              clientId: client.id,
              referenceAt: now,
              timeZone: BONUS_SUM_THRESHOLD_TIMEZONE
            })
          ])
        : [0, new Map<number, number>()];

    const prereqEnvBase = {
      tx,
      tenantId,
      client,
      orderAgent,
      orderedProductIds,
      productById,
      baseSubtotalBeforeDiscount: totalSum,
      qtyByProduct,
      clientUsedAutoBonusRuleIds: usedRuleIds,
      giftOverrides: validatedGiftOverrides,
      warehouseId: input.warehouse_id,
      availableByProductId,
      ruleCache: new Map<number, BonusRuleRow | null>(),
      clientMonthMerchandiseSubtotalExclOrder: new Prisma.Decimal(0),
      clientMonthPaidQtyAggregateExclOrder,
      clientMonthPaidQtyByProductExclOrder
    };

    const qtyPeeks = await findQtyBonusPeeks(
      tx,
      tenantId,
      client,
      qtyByProduct,
      productById,
      orderedProductIds,
      usedRuleIds,
      validatedGiftOverrides,
      input.warehouse_id,
      { rules: qtyRules, prereqEnv: prereqEnvBase, orderAgent, availableByProductId }
    );

    for (const peek of qtyPeeks) {
      if (peek.giftPid > 0) stockProductIds.add(peek.giftPid);
    }

    const extraStockIds = [...stockProductIds].filter((id) => !availableByProductId.has(id));
    if (extraStockIds.length > 0) {
      const extraStock = await loadAvailableQtyByProductId(tx, tenantId, input.warehouse_id, extraStockIds);
      availableByProductId = new Map([...availableByProductId, ...extraStock]);
      prereqEnvBase.availableByProductId = availableByProductId;
    }

    const eligibleDiscounts = await findAllEligibleDiscountRules(
      discountRules,
      client,
      orderedProductIds,
      productById,
      usedRuleIds,
      prereqEnvBase,
      now
    );

    const sumPeek = await findWinningSumPeek(
      tx,
      tenantId,
      client,
      totalSum,
      orderedProductIds,
      productById,
      usedRuleIds,
      qtyByProduct,
      { rules: sumRules, prereqEnv: prereqEnvBase }
    );

    if (sumPeek) {
      for (const id of sumPeek.rule.bonus_product_ids) stockProductIds.add(id);
      for (const id of sumPeek.rule.product_ids) stockProductIds.add(id);
      if (sumPeek.giftPid > 0) stockProductIds.add(sumPeek.giftPid);
    }

    const bonusRuleIds = new Set<number>();
    for (const p of qtyPeeks) bonusRuleIds.add(p.rule.id);
    if (sumPeek) bonusRuleIds.add(sumPeek.rule.id);

    const giftProductIds = new Set<number>();
    for (const p of qtyPeeks) {
      const ids = await resolveAllowedGiftProductIdsForRule(
        tenantId,
        p.rule,
        p.giftPid > 0 ? p.giftPid : undefined
      );
      for (const id of ids) giftProductIds.add(id);
    }
    if (sumPeek) {
      const ids = await resolveAllowedGiftProductIdsForRule(
        tenantId,
        sumPeek.rule,
        sumPeek.giftPid > 0 ? sumPeek.giftPid : undefined
      );
      for (const id of ids) giftProductIds.add(id);
    }

    const giftStockIds = [...giftProductIds].filter((id) => !stockProductIds.has(id));
    if (giftStockIds.length > 0) {
      const extraStock = await loadAvailableQtyByProductId(tx, tenantId, input.warehouse_id, giftStockIds);
      availableByProductId = new Map([...availableByProductId, ...extraStock]);
    }

    const products =
      giftProductIds.size > 0 ?
        await tx.product.findMany({
          where: { tenant_id: tenantId, id: { in: [...giftProductIds] } },
          select: {
            id: true,
            name: true,
            category_id: true,
            category: { select: { name: true } }
          },
          orderBy: { name: "asc" }
        })
      : [];

    const productMap = new Map(products.map((p) => [p.id, p]));

    const eligibleBonuses: Array<EligibleBonusRow> = [];
    for (const peek of qtyPeeks) {
      if (!ruleRelatesToOrderSelection(peek.rule, orderedProductIds, productById)) continue;
      const giftIds = await resolveAllowedGiftProductIdsForRule(
        tenantId,
        peek.rule,
        peek.giftPid > 0 ? peek.giftPid : undefined
      );
      const gift_products = await mapGiftProducts(giftIds, productMap, availableByProductId, qtyByProduct);
      const meta = bonusGiftSelectionMeta(peek.rule, gift_products.length);
      eligibleBonuses.push({
        rule_id: peek.rule.id,
        name: peek.rule.name,
        type: peek.rule.type,
        bonus_qty: peek.bonusQty,
        /** Tanlanadigan bonus dona limiti (hisoblangan); `free_qty` emas. */
        max_bonus_qty: peek.bonusQty > 0 ? peek.bonusQty : null,
        prerequisite_rule_ids: peek.rule.prerequisite_rule_ids ?? [],
        default_gift_product_id: peek.giftPid > 0 ? peek.giftPid : giftIds[0] ?? null,
        gift_selection_kind: meta.kind,
        allow_gift_swap: meta.allow_gift_swap,
        gift_products
      });
    }

    if (sumPeek && ruleRelatesToOrderSelection(sumPeek.rule, orderedProductIds, productById)) {
      const giftIds = await resolveAllowedGiftProductIdsForRule(
        tenantId,
        sumPeek.rule,
        sumPeek.giftPid > 0 ? sumPeek.giftPid : undefined
      );
      const gift_products = await mapGiftProducts(giftIds, productMap, availableByProductId, qtyByProduct);
      const meta = bonusGiftSelectionMeta(sumPeek.rule, gift_products.length);
      eligibleBonuses.push({
        rule_id: sumPeek.rule.id,
        name: sumPeek.rule.name,
        type: sumPeek.rule.type,
        bonus_qty: sumPeek.units,
        max_bonus_qty: sumPeek.units > 0 ? sumPeek.units : null,
        prerequisite_rule_ids: sumPeek.rule.prerequisite_rule_ids ?? [],
        default_gift_product_id: sumPeek.giftPid > 0 ? sumPeek.giftPid : giftIds[0] ?? null,
        gift_selection_kind: meta.kind,
        allow_gift_swap: meta.allow_gift_swap,
        gift_products
      });
    }

    const dedupedEligibleBonuses = filterEligibleBonusesForPreview(
      dedupeEligibleBonusRows(eligibleBonuses),
      stackPolicy,
      resolved.appliedAutoBonusRuleIds.filter((id) => {
        const rule = discountRules.find((r) => r.id === id);
        return rule?.type !== "discount";
      })
    );

    const links: Array<{ bonus_rule_id: number; discount_rule_id: number }> = [];
    for (const d of eligibleDiscounts) {
      for (const pid of d.prerequisite_rule_ids ?? []) {
        if (bonusRuleIds.has(pid)) {
          links.push({ bonus_rule_id: pid, discount_rule_id: d.id });
        }
      }
    }

    const discountRule = await findWinningDiscountRuleWithPrereqs(
      discountRules,
      client,
      orderedProductIds,
      productById,
      usedRuleIds,
      prereqEnvBase,
      now,
      {
        baseSubtotalBeforeDiscount: totalSum,
        monthMerchandiseSubtotalExclOrder: prereqEnvBase.clientMonthMerchandiseSubtotalExclOrder
      }
    );

    const rawDisc = totalSum.sub(resolved.total);
    const discountSum = rawDisc.gt(0) ? Number(rawDisc.toFixed(2)) : 0;
    const expectedDiscountSum = calcExpectedDiscountSum(
      totalSum,
      discountRule?.discount_pct != null ? Number(discountRule.discount_pct) : null
    );
    let bonusSum = 0;
    for (const b of resolved.bonusDrafts) {
      bonusSum += Number(b.total);
    }

    let bonusGifts = resolved.bonusDrafts.map((b) => ({
      product_id: b.product_id,
      qty: Number(b.qty),
      total: Number(b.total)
    }));
    if (bonusGifts.length === 0) {
      const appliedQtyIds = resolved.appliedAutoBonusRuleIds.filter((id) =>
        qtyPeeks.some((p) => p.rule.id === id)
      );
      if (appliedQtyIds.length > 0) {
        const toMaterialize = qtyPeeks.filter((p) => appliedQtyIds.includes(p.rule.id));
        const drafts = await materializeQtyPeeks(tenantId, toMaterialize);
        bonusGifts = drafts.map((b) => ({
          product_id: b.product_id,
          qty: Number(b.qty),
          total: Number(b.total)
        }));
        bonusSum = 0;
        for (const b of drafts) {
          bonusSum += Number(b.total);
        }
      }
    }

    const linkedPairs: Array<{ bonus_rule_id: number; discount_rule_id: number }> = [];
    for (const b of dedupedEligibleBonuses) {
      for (const d of eligibleDiscounts) {
        const br = qtyPeeks.find((p) => p.rule.id === b.rule_id)?.rule ?? sumPeek?.rule;
        if (br && rulesLinked(br, d)) {
          linkedPairs.push({ bonus_rule_id: b.rule_id, discount_rule_id: d.id });
        }
      }
    }

    const discountCashDeskAvailable =
      (await tx.cashDesk.count({
        where: {
          tenant_id: tenantId,
          is_active: true,
          accepts_discount_payments: true
        }
      })) > 0;

    return {
      bonus_stack: bonusPolicyToJson(stackPolicy),
      eligible_bonuses: dedupedEligibleBonuses,
      eligible_discounts: eligibleDiscounts.map((d) => ({
        rule_id: d.id,
        name: d.name,
        discount_pct: d.discount_pct != null ? Number(d.discount_pct) : null,
        prerequisite_rule_ids: d.prerequisite_rule_ids ?? []
      })),
      links,
      linked_pairs: linkedPairs,
      discount_cash_desk_available: discountCashDeskAvailable,
      auto_apply: {
        bonus_rule_ids: resolved.appliedAutoBonusRuleIds.filter((id) => {
          const rule = discountRules.find((r) => r.id === id);
          return rule?.type !== "discount";
        }),
        discount_rule_id: discountRule?.id ?? null,
        discount_pct: discountRule?.discount_pct != null ? Number(discountRule.discount_pct) : null,
        discount_sum: discountSum,
        expected_discount_sum: expectedDiscountSum,
        bonus_sum: Number(bonusSum.toFixed(2)),
        bonus_gifts: bonusGifts
      }
    };
  });
}
