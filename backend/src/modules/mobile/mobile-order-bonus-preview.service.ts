import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  bonusRuleInclude,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { parseBonusStackPolicy, bonusPolicyToJson } from "../orders/bonus-stack-policy";
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
  type OrderAgentBonusContext
} from "../orders/order-bonus-apply";
import { ruleRelatesToOrderSelection } from "../orders/order-bonus-context";
import { bonusGiftSelectionMeta, resolveAllowedGiftProductIdsForRule } from "../orders/bonus-gift-selection";
import { findWinningDiscountRuleWithPrereqs } from "../orders/order-bonus-discount";
import { calcExpectedDiscountSum } from "../orders/order-discount-alert";
import { activeRuleWhere } from "../orders/order-bonus-context.match-gifts";
import { collectRuleStockProductIds, ruleOrAnyClauseUsesCalendarMonth } from "../orders/order-bonus-clauses";
import { buildCreateOrderLineData } from "../orders/domain/order.create-lines";
import type { BonusGiftOverrideInput } from "../orders/domain/order.types";
import { validateBonusGiftOverrides } from "../orders/domain/order.detail-mappers";
import {
  buildQtyEligibleRowsFromPeeks,
  dedupeEligibleBonusRows,
  filterEligibleBonusesForPreview,
  rulesLinked,
  type EligibleBonusRow
} from "./mobile-order-bonus-preview.compute";
import { findAllEligibleDiscountRules, mapGiftProducts } from "./mobile-order-bonus-preview.query";

export type MobileBonusPreviewInput = {
  client_id: number;
  warehouse_id: number;
  price_type?: string;
  items: { product_id: number; qty: number }[];
  bonus_gift_overrides?: BonusGiftOverrideInput[];
};

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

    const qtyRulesRaw = await tx.bonusRule.findMany({
      where: activeRuleWhere(tenantId, "qty", now),
      include: bonusRuleInclude,
      orderBy: { priority: "desc" }
    });
    const qtyRules = qtyRulesRaw.map((r) => mapBonusRuleFull(r));

    const stockProductIds = collectRuleStockProductIds([...qtyRules, ...sumRules]);
    for (const pid of qtyByProduct.keys()) stockProductIds.add(pid);

    let availableByProductId = await loadAvailableQtyByProductId(
      tx,
      tenantId,
      input.warehouse_id,
      stockProductIds
    );

    const needsQtyMonth = qtyRules.some((r) => ruleOrAnyClauseUsesCalendarMonth(r));
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
      for (const g of sumPeek.extraGifts ?? []) {
        if (g.giftPid > 0) stockProductIds.add(g.giftPid);
      }
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
    const qtyEligible = buildQtyEligibleRowsFromPeeks(
      qtyPeeks.filter((peek) => {
        if ((peek.rule.clauses?.length ?? 0) > 0) return true;
        return ruleRelatesToOrderSelection(peek.rule, orderedProductIds, productById);
      }),
      productMap,
      availableByProductId,
      qtyByProduct
    );
    eligibleBonuses.push(...qtyEligible);

    if (
      sumPeek &&
      ((sumPeek.rule.clauses?.length ?? 0) > 0 ||
        ruleRelatesToOrderSelection(sumPeek.rule, orderedProductIds, productById))
    ) {
      const giftIds = await resolveAllowedGiftProductIdsForRule(
        tenantId,
        sumPeek.rule,
        sumPeek.giftPid > 0 ? sumPeek.giftPid : undefined
      );
      const sumBonusByPid = new Map<number, number>();
      if (sumPeek.giftPid > 0) {
        sumBonusByPid.set(sumPeek.giftPid, sumPeek.units);
      }
      for (const g of sumPeek.extraGifts ?? []) {
        if (g.giftPid > 0) {
          sumBonusByPid.set(g.giftPid, (sumBonusByPid.get(g.giftPid) ?? 0) + g.units);
        }
      }
      const gift_products = mapGiftProducts(
        giftIds,
        productMap,
        availableByProductId,
        qtyByProduct,
        sumBonusByPid.size > 0 ? sumBonusByPid : undefined
      );
      const meta = bonusGiftSelectionMeta(sumPeek.rule, gift_products.length);
      const totalUnits =
        sumPeek.units + (sumPeek.extraGifts ?? []).reduce((a, g) => a + g.units, 0);
      eligibleBonuses.push({
        rule_id: sumPeek.rule.id,
        name: sumPeek.rule.name,
        type: sumPeek.rule.type,
        bonus_qty: totalUnits,
        max_bonus_qty: totalUnits > 0 ? totalUnits : null,
        prerequisite_rule_ids: sumPeek.rule.prerequisite_rule_ids ?? [],
        default_gift_product_id: sumPeek.giftPid > 0 ? sumPeek.giftPid : giftIds[0] ?? null,
        gift_selection_kind: meta.kind,
        allow_gift_swap: meta.allow_gift_swap,
        step_qty: null,
        bonus_step_qty: null,
        trigger_product_ids: sumPeek.rule.product_ids ?? [],
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
