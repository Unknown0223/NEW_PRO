import { Prisma, Prisma as PrismaClient } from "@prisma/client";
import { utcRangeForCalendarMonthContaining } from "../../lib/calendar-month-range";
import {
  bonusRuleInclude,
  computeQtyBonusForRuleRow,
  mapBonusRuleFull,
  type BonusRuleRow
} from "../bonus-rules/bonus-rules.service";
import { getProductPrice } from "../products/product-prices.service";
import { resolveBonusSlotTakeCount, type BonusStackPolicy } from "./bonus-stack-policy";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "./order-status";
import {
  type OrderAgentBonusContext,
  type OrderBonusPrereqEnv,
  type PaidLineDraft,
  type ProductLite,
  ruleBlockedByOncePerClient,
  ruleMatchesClient,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope,
  ruleNeedsOrderContext,
  ruleTreeSatisfiedForOrder,
  roundMoney
} from "./order-bonus-context";

export async function findWinningDiscountRuleWithPrereqs(
  discountRulesSorted: BonusRuleRow[],
  client: { id: number; category: string | null },
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number>,
  prereqEnv: OrderBonusPrereqEnv,
  now: Date
): Promise<BonusRuleRow | null> {
  const candidates = discountRulesSorted
    .filter((r) => r.type === "discount" && !ruleNeedsOrderContext(r) && !ruleBlockedByOncePerClient(r, clientUsedAutoBonusRuleIds))
    .filter((r) => ruleMatchesClient(r, client))
    .filter((r) => ruleMatchesOrderAgentScope(r, prereqEnv.orderAgent))
    .filter((r) => ruleMatchesOrderProductScope(r, orderedProductIds, productById))
    .filter((r) => r.discount_pct != null && r.discount_pct > 0);
  for (const r of candidates) {
    if (!(await ruleTreeSatisfiedForOrder(r, prereqEnv, now, new Set()))) continue;
    return r;
  }
  return null;
}

export function findWinningDiscountRule(
  discountRulesSorted: BonusRuleRow[],
  client: { id: number; category: string | null },
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  orderAgent: OrderAgentBonusContext | null = null
): BonusRuleRow | null {
  const candidates = discountRulesSorted
    .filter((r) => r.type === "discount" && !ruleNeedsOrderContext(r) && !ruleBlockedByOncePerClient(r, clientUsedAutoBonusRuleIds))
    .filter((r) => ruleMatchesClient(r, client))
    .filter((r) => ruleMatchesOrderAgentScope(r, orderAgent))
    .filter((r) => ruleMatchesOrderProductScope(r, orderedProductIds, productById))
    .filter((r) => r.discount_pct != null && r.discount_pct > 0);
  return candidates[0] ?? null;
}

export function applyDiscountWithRule(
  rule: BonusRuleRow,
  paidLines: PaidLineDraft[],
  paidTotal: PrismaClient.Decimal
): { lines: PaidLineDraft[]; total: PrismaClient.Decimal } {
  if (rule.discount_pct == null) {
    return { lines: paidLines.map((l) => ({ ...l })), total: paidTotal };
  }
  const lines = paidLines.map((l) => ({ ...l }));
  const hundred = new PrismaClient.Decimal(100);
  const factor = hundred.sub(new PrismaClient.Decimal(rule.discount_pct)).div(hundred);
  const target = roundMoney(paidTotal.mul(factor));
  if (lines.length === 0) {
    return { lines, total: target };
  }

  let allocated = new PrismaClient.Decimal(0);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (i === lines.length - 1) {
      const nt = roundMoney(target.sub(allocated));
      l.total = nt;
      l.price = nt.div(l.qty);
      continue;
    }
    const nt = roundMoney(l.total.mul(factor));
    allocated = allocated.add(nt);
    l.total = nt;
    l.price = nt.div(l.qty);
  }
  return { lines, total: target };
}

/**
 * Birinchi mos `discount` qoidasi (priority kamayish): to‘lov qatorlariga foizli chegirma.
 */
export function applyAutomaticDiscountToPaidLines(
  paidLines: PaidLineDraft[],
  paidTotal: PrismaClient.Decimal,
  discountRulesSorted: BonusRuleRow[],
  client: { id: number; category: string | null },
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>,
  clientUsedAutoBonusRuleIds: ReadonlySet<number> = new Set(),
  orderAgent: OrderAgentBonusContext | null = null
): { lines: PaidLineDraft[]; total: PrismaClient.Decimal } {
  const rule = findWinningDiscountRule(
    discountRulesSorted,
    client,
    orderedProductIds,
    productById,
    clientUsedAutoBonusRuleIds,
    orderAgent
  );
  if (!rule) {
    return { lines: paidLines.map((l) => ({ ...l })), total: paidTotal };
  }
  return applyDiscountWithRule(rule, paidLines, paidTotal);
}
