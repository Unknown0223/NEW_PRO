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

import type { OrderAgentBonusContext, ProductLite } from "./order-bonus-context.fetch";
import {
  ruleHasPurchaseScope,
  ruleMatchesOrderAgentScope,
  ruleMatchesOrderProductScope
} from "./order-bonus-context.match-scope";

export async function loadAvailableQtyByProductId(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number | null | undefined,
  productIds: Iterable<number>
): Promise<Map<number, number>> {
  const ids = [...new Set(productIds)].filter((id) => id > 0);
  if (warehouseId == null || warehouseId < 1 || ids.length === 0) {
    return new Map();
  }
  const rows = await tx.stock.findMany({
    where: { tenant_id: tenantId, warehouse_id: warehouseId, product_id: { in: ids } },
    select: { product_id: true, qty: true, reserved_qty: true }
  });
  const map = new Map<number, number>();
  for (const s of rows) {
    // Manfiy reserved (eski/buzuq ma'lumot) mavjudlikni oshirmasin.
    const free = Number(s.qty) - Math.max(0, Number(s.reserved_qty));
    map.set(s.product_id, Math.max(0, free));
  }
  for (const id of ids) {
    if (!map.has(id)) map.set(id, 0);
  }
  return map;
}

/** Mijoz uchun avval `once_per_client` qoidalar qaysi ID lar bilan qo‘llangan (faqat shu qatorlar). */
export async function fetchClientUsedAutoBonusRuleIds(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number
): Promise<Set<number>> {
  const rows = await tx.order.findMany({
    where: { tenant_id: tenantId, client_id: clientId },
    select: { applied_auto_bonus_rule_ids: true }
  });
  const out = new Set<number>();
  for (const r of rows) {
    for (const id of r.applied_auto_bonus_rule_ids) {
      out.add(id);
    }
  }
  return out;
}

/** `once_per_client` hisobida joriy zakaz (tahrir) hisobga olinmasin. */
export async function fetchClientUsedAutoBonusRuleIdsExcludingOrder(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  excludeOrderId: number
): Promise<Set<number>> {
  const rows = await tx.order.findMany({
    where: {
      tenant_id: tenantId,
      client_id: clientId,
      id: { not: excludeOrderId }
    },
    select: { applied_auto_bonus_rule_ids: true }
  });
  const out = new Set<number>();
  for (const r of rows) {
    for (const id of r.applied_auto_bonus_rule_ids) {
      out.add(id);
    }
  }
  return out;
}

export function ruleBlockedByOncePerClient(rule: BonusRuleRow, clientUsedRuleIds: ReadonlySet<number>): boolean {
  return rule.once_per_client && clientUsedRuleIds.has(rule.id);
}

export function ruleMatchesProduct(rule: BonusRuleRow, product: ProductLite): boolean {
  if (rule.product_ids.length > 0 && !rule.product_ids.includes(product.id)) {
    return false;
  }
  if (rule.product_category_ids.length > 0) {
    if (product.category_id == null || !rule.product_category_ids.includes(product.category_id)) {
      return false;
    }
  }
  return true;
}

/** Summa bonusi: `bonus_product_ids` bo‘sh bo‘lsa — zakazdagi mos qatorlardan eng ko‘p miqdorli SKU (tenglikda kichik id). */
export function resolveSumRuleGiftProductId(
  rule: BonusRuleRow,
  orderedProductIds: ReadonlySet<number>,
  productById: ReadonlyMap<number, ProductLite>,
  qtyByProduct: ReadonlyMap<number, number>
): number | null {
  const direct = rule.bonus_product_ids[0];
  if (direct != null && direct > 0) return direct;

  let bestPid = 0;
  let bestQty = -1;
  for (const pid of orderedProductIds) {
    const p = productById.get(pid);
    if (!p) continue;
    if (!ruleMatchesProduct(rule, p)) continue;
    const q = qtyByProduct.get(pid) ?? 0;
    if (bestPid === 0) {
      bestPid = pid;
      bestQty = q;
      continue;
    }
    if (q > bestQty || (q === bestQty && pid < bestPid)) {
      bestPid = pid;
      bestQty = q;
    }
  }
  return bestPid > 0 ? bestPid : null;
}

export const activeRuleWhere = (tenantId: number, type: string, now: Date) => ({
  tenant_id: tenantId,
  type,
  is_active: true,
  is_manual: false,
  AND: [
    { OR: [{ valid_from: null }, { valid_from: { lte: now } }] },
    { OR: [{ valid_to: null }, { valid_to: { gte: now } }] }
  ]
});

/** Zakaz yechimi: qoida daraxti (o‘zaro bog‘langan qoidalar) uchun kontekst. */
export type OrderBonusPrereqEnv = {
  tx: Prisma.TransactionClient;
  tenantId: number;
  client: { id: number; category: string | null };
  /** Zakaz agenti; cheklov yo‘q qoidalarda `null` ham bo‘lishi mumkin. */
  orderAgent: OrderAgentBonusContext | null;
  orderedProductIds: ReadonlySet<number>;
  productById: ReadonlyMap<number, ProductLite>;
  baseSubtotalBeforeDiscount: PrismaClient.Decimal;
  qtyByProduct: ReadonlyMap<number, number>;
  clientUsedAutoBonusRuleIds: ReadonlySet<number>;
  giftOverrides: ReadonlyMap<number, number>;
  warehouseId?: number | null;
  availableByProductId: ReadonlyMap<number, number>;
  ruleCache: Map<number, BonusRuleRow | null>;
  /** Shu kalendar oyidagi boshqa zakazlar: `total_sum + discount_sum` (joriy zakaz chiqarilgan). */
  clientMonthMerchandiseSubtotalExclOrder: PrismaClient.Decimal;
  /** Boshqa zakazlardan pullik donalar jami (bonus qatorlarsiz), joriy zakaz chiqarilgan — `qty` + calendar_month. */
  clientMonthPaidQtyAggregateExclOrder: number;
  /** SKU bo‘yicha boshqa zakazlardan pullik donalar, joriy zakaz chiqarilgan. */
  clientMonthPaidQtyByProductExclOrder: ReadonlyMap<number, number>;
};

