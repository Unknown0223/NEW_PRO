import {
  bonusRuleInclude,
  computeQtyBonusForRuleRow,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { Prisma as PrismaClient } from "@prisma/client";
import {
  effectivePurchasedQtyForQtyRule,
  effectiveSubtotalForSumMinRule,
  ruleMatchesClient,
  ruleNeedsOrderContext
} from "./order-bonus-context.fetch";
import {
  QTY_AGGREGATE_PURCHASED_PID,
  resolveQtyGiftProductId,
  resolveSumRuleGiftProductId,
  ruleBlockedByOncePerClient,
  ruleHasPurchaseScope,
  sumMatchingOrderQtyForQtyRule,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleMatchesProduct,
  type OrderBonusPrereqEnv,
  type QtyGiftResolveContext
} from "./order-bonus-context.match";

function ruleActiveAt(rule: BonusRuleRow, now: Date): boolean {
  if (!rule.is_active) return false;
  if (rule.valid_from) {
    const vf = new Date(rule.valid_from);
    if (vf > now) return false;
  }
  if (rule.valid_to) {
    const vt = new Date(rule.valid_to);
    if (vt < now) return false;
  }
  return true;
}

async function ensurePrereqRule(env: OrderBonusPrereqEnv, id: number): Promise<BonusRuleRow | null> {
  if (env.ruleCache.has(id)) return env.ruleCache.get(id) ?? null;
  const raw = await env.tx.bonusRule.findFirst({
    where: { id, tenant_id: env.tenantId },
    include: bonusRuleInclude
  });
  const row = raw ? mapBonusRuleFull(raw) : null;
  env.ruleCache.set(id, row);
  return row;
}

function qtyRuleWouldProduceAnyPeek(rule: BonusRuleRow, env: OrderBonusPrereqEnv): boolean {
  let totalPaidQty = 0;
  for (const q of env.qtyByProduct.values()) {
    if (q > 0) totalPaidQty += q;
  }

  if (!ruleHasPurchaseScope(rule)) {
    const eff = effectivePurchasedQtyForQtyRule(rule, {
      orderQty: totalPaidQty,
      productIdForMonthLookup: null,
      monthAggregateExclOrder: env.clientMonthPaidQtyAggregateExclOrder,
      monthByProductExclOrder: env.clientMonthPaidQtyByProductExclOrder
    });
    const bonusUnits = computeQtyBonusForRuleRow(rule, eff);
    if (bonusUnits <= 0) return false;
    const ctx: QtyGiftResolveContext = { availableByProductId: env.availableByProductId, minUnits: bonusUnits };
    if (rule.bonus_product_ids.length === 0) {
      let heroPid = 0;
      let heroQ = 0;
      for (const [pid, q] of env.qtyByProduct) {
        if (q > heroQ) {
          heroQ = q;
          heroPid = pid;
        }
      }
      if (heroPid <= 0) return false;
      return resolveQtyGiftProductId(rule, heroPid, env.giftOverrides, ctx) > 0;
    }
    return resolveQtyGiftProductId(rule, QTY_AGGREGATE_PURCHASED_PID, env.giftOverrides, ctx) > 0;
  }

  const { totalQty: scopedQty, heroProductId } = sumMatchingOrderQtyForQtyRule(
    rule,
    env.qtyByProduct,
    env.productById
  );
  if (scopedQty <= 0) return false;
  const eff = effectivePurchasedQtyForQtyRule(rule, {
    orderQty: scopedQty,
    productIdForMonthLookup: null,
    monthAggregateExclOrder: env.clientMonthPaidQtyAggregateExclOrder,
    monthByProductExclOrder: env.clientMonthPaidQtyByProductExclOrder
  });
  const bonusUnits = computeQtyBonusForRuleRow(rule, eff);
  if (bonusUnits <= 0) return false;
  const purchasedPid =
    rule.bonus_product_ids.length === 0 ? heroProductId : QTY_AGGREGATE_PURCHASED_PID;
  const giftPid = resolveQtyGiftProductId(rule, purchasedPid, env.giftOverrides, {
    availableByProductId: env.availableByProductId,
    minUnits: bonusUnits
  });
  return giftPid > 0;
}

function ruleMatchesAsStandaloneAutoBonusForOrder(rule: BonusRuleRow, env: OrderBonusPrereqEnv, now: Date): boolean {
  if (rule.is_manual) return false;
  if (ruleNeedsOrderContext(rule)) return false;
  if (!ruleActiveAt(rule, now)) return false;
  if (ruleBlockedByOncePerClient(rule, env.clientUsedAutoBonusRuleIds)) return false;
  if (!ruleMatchesClient(rule, env.client)) return false;
  if (!ruleMatchesOrderAgentScope(rule, env.orderAgent)) return false;
  if (!ruleMatchesOrderProductScope(rule, env.orderedProductIds, env.productById)) return false;

  if (rule.type === "discount") {
    return rule.discount_pct != null && rule.discount_pct > 0;
  }
  if (rule.type === "sum") {
    if (rule.min_sum == null) return false;
    const effective = effectiveSubtotalForSumMinRule(
      rule,
      env.baseSubtotalBeforeDiscount,
      env.clientMonthMerchandiseSubtotalExclOrder
    );
    if (effective.lt(new PrismaClient.Decimal(rule.min_sum))) return false;
    if (rule.discount_pct != null && Number(rule.discount_pct) > 0) return true;
    const giftPid = resolveSumRuleGiftProductId(rule, env.orderedProductIds, env.productById, env.qtyByProduct);
    return giftPid != null && giftPid > 0;
  }
  if (rule.type === "qty") {
    return qtyRuleWouldProduceAnyPeek(rule, env);
  }
  return false;
}

export async function ruleTreeSatisfiedForOrder(
  rule: BonusRuleRow,
  env: OrderBonusPrereqEnv,
  now: Date,
  stack: Set<number>
): Promise<boolean> {
  if (stack.has(rule.id)) return false;
  stack.add(rule.id);
  try {
    const ids = rule.prerequisite_rule_ids ?? [];
    for (const pid of ids) {
      const pr = await ensurePrereqRule(env, pid);
      if (!pr) return false;
      if (!(await ruleTreeSatisfiedForOrder(pr, env, now, stack))) return false;
    }
    return ruleMatchesAsStandaloneAutoBonusForOrder(rule, env, now);
  } finally {
    stack.delete(rule.id);
  }
}

