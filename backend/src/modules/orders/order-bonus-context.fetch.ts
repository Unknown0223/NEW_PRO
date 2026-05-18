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

export type ProductLite = { id: number; category_id: number | null };

export type PaidLineDraft = {
  product_id: number;
  qty: PrismaClient.Decimal;
  price: PrismaClient.Decimal;
  total: PrismaClient.Decimal;
};

export type BonusLineDraft = {
  product_id: number;
  qty: PrismaClient.Decimal;
  price: PrismaClient.Decimal;
  total: PrismaClient.Decimal;
  is_bonus: true;
};

export function roundMoney(d: PrismaClient.Decimal): PrismaClient.Decimal {
  return d.toDecimalPlaces(2, PrismaClient.Decimal.ROUND_HALF_UP);
}

/** Summa-porog uchun kalendar oyi chegaralari (mijoz bo‘yicha yig‘indi). */
export const BONUS_SUM_THRESHOLD_TIMEZONE = "Asia/Tashkent";

export async function fetchClientMonthMerchandiseSubtotalExclOrder(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: number;
    clientId: number;
    referenceAt: Date;
    excludeOrderId?: number;
    timeZone?: string;
  }
): Promise<PrismaClient.Decimal> {
  const tz = opts.timeZone ?? BONUS_SUM_THRESHOLD_TIMEZONE;
  const { startUtc, endUtcExclusive } = utcRangeForCalendarMonthContaining(opts.referenceAt, tz);
  const excluded = Prisma.join(
    ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE.map((s) => Prisma.sql`${s}`)
  );
  const excl =
    opts.excludeOrderId != null ? Prisma.sql`AND o.id <> ${opts.excludeOrderId}` : Prisma.empty;
  const rows = await tx.$queryRaw<[{ total: unknown }]>(Prisma.sql`
    SELECT COALESCE(SUM(o.total_sum + o.discount_sum), 0) AS total
    FROM orders o
    WHERE o.tenant_id = ${opts.tenantId}
      AND o.client_id = ${opts.clientId}
      AND o.order_type = 'order'
      AND o.status NOT IN (${excluded})
      AND o.created_at >= ${startUtc}
      AND o.created_at < ${endUtcExclusive}
      ${excl}
  `);
  const v = rows[0]?.total;
  return v != null ? new PrismaClient.Decimal(String(v)) : new PrismaClient.Decimal(0);
}

/** Kalendar oy: boshqa zakazlardan pullik qatorlar `qty` yig‘indisi (bonus qatorlarsiz), joriy zakaz chiqarilgan. */
export async function fetchClientMonthPaidQtyAggregateExclOrder(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: number;
    clientId: number;
    referenceAt: Date;
    excludeOrderId?: number;
    timeZone?: string;
  }
): Promise<number> {
  const tz = opts.timeZone ?? BONUS_SUM_THRESHOLD_TIMEZONE;
  const { startUtc, endUtcExclusive } = utcRangeForCalendarMonthContaining(opts.referenceAt, tz);
  const excluded = Prisma.join(
    ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE.map((s) => Prisma.sql`${s}`)
  );
  const excl =
    opts.excludeOrderId != null ? Prisma.sql`AND o.id <> ${opts.excludeOrderId}` : Prisma.empty;
  const rows = await tx.$queryRaw<[{ total: unknown }]>(Prisma.sql`
    SELECT COALESCE(SUM(oi.qty), 0) AS total
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${opts.tenantId}
      AND o.client_id = ${opts.clientId}
      AND o.order_type = 'order'
      AND o.status NOT IN (${excluded})
      AND o.created_at >= ${startUtc}
      AND o.created_at < ${endUtcExclusive}
      AND oi.is_bonus = false
      ${excl}
  `);
  const v = rows[0]?.total;
  return v != null ? Number(String(v)) : 0;
}

/** SKU bo‘yicha shu oy (boshqa zakazlar), joriy zakaz chiqarilgan. */
export async function fetchClientMonthPaidQtyByProductExclOrder(
  tx: Prisma.TransactionClient,
  opts: {
    tenantId: number;
    clientId: number;
    referenceAt: Date;
    excludeOrderId?: number;
    timeZone?: string;
  }
): Promise<Map<number, number>> {
  const tz = opts.timeZone ?? BONUS_SUM_THRESHOLD_TIMEZONE;
  const { startUtc, endUtcExclusive } = utcRangeForCalendarMonthContaining(opts.referenceAt, tz);
  const excluded = Prisma.join(
    ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE.map((s) => Prisma.sql`${s}`)
  );
  const excl =
    opts.excludeOrderId != null ? Prisma.sql`AND o.id <> ${opts.excludeOrderId}` : Prisma.empty;
  const rows = await tx.$queryRaw<{ product_id: number; total: unknown }[]>(Prisma.sql`
    SELECT oi.product_id, COALESCE(SUM(oi.qty), 0) AS total
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    WHERE o.tenant_id = ${opts.tenantId}
      AND o.client_id = ${opts.clientId}
      AND o.order_type = 'order'
      AND o.status NOT IN (${excluded})
      AND o.created_at >= ${startUtc}
      AND o.created_at < ${endUtcExclusive}
      AND oi.is_bonus = false
      ${excl}
    GROUP BY oi.product_id
  `);
  const m = new Map<number, number>();
  for (const r of rows) {
    m.set(r.product_id, Number(String(r.total)));
  }
  return m;
}

/**
 * `qty` qoidasi: shartdagi sotib olingan miqdor bilan solishtiriladi.
 * `calendar_month` — boshqa zakazlardagi yig‘indi + joriy zakazdagi tegishli miqdor (SKU yoki zakaz bo‘yicha).
 */
export function effectivePurchasedQtyForQtyRule(
  rule: BonusRuleRow,
  opts: {
    orderQty: number;
    /** `null` — asortimentsiz (zakaz bo‘yicha jami dona) */
    productIdForMonthLookup: number | null;
    monthAggregateExclOrder: number;
    monthByProductExclOrder: ReadonlyMap<number, number>;
  }
): number {
  if (rule.type !== "qty") return opts.orderQty;
  if ((rule.sum_threshold_scope ?? "order") !== "calendar_month") return opts.orderQty;
  if (opts.productIdForMonthLookup == null) {
    return opts.monthAggregateExclOrder + opts.orderQty;
  }
  const prev = opts.monthByProductExclOrder.get(opts.productIdForMonthLookup) ?? 0;
  return prev + opts.orderQty;
}

/** `min_sum` bilan solishtiriladigan yig‘indi: zakaz yoki oy (boshqa zakazlar + joriy). */
export function effectiveSubtotalForSumMinRule(
  rule: BonusRuleRow,
  baseSubtotalBeforeDiscount: PrismaClient.Decimal,
  clientMonthMerchandiseExclOrder: PrismaClient.Decimal
): PrismaClient.Decimal {
  if (rule.type !== "sum") return baseSubtotalBeforeDiscount;
  if ((rule.sum_threshold_scope ?? "order") === "calendar_month") {
    return clientMonthMerchandiseExclOrder.add(baseSubtotalBeforeDiscount);
  }
  return baseSubtotalBeforeDiscount;
}

export function ruleNeedsOrderContext(rule: BonusRuleRow): boolean {
  const nonempty = (s: string | null | undefined) => s != null && String(s).trim() !== "";
  return (
    nonempty(rule.payment_type) ||
    nonempty(rule.client_type) ||
    nonempty(rule.sales_channel) ||
    nonempty(rule.price_type)
  );
}

export function ruleMatchesClient(
  rule: BonusRuleRow,
  client: { id: number; category: string | null }
): boolean {
  if (!rule.target_all_clients && !rule.selected_client_ids.includes(client.id)) {
    return false;
  }
  if (rule.client_category != null && String(rule.client_category).trim() !== "") {
    if (String(rule.client_category).trim() !== String(client.category ?? "").trim()) {
      return false;
    }
  }
  return true;
}

/** Zakazdagi agent (bonus cheklovi uchun). */
export type OrderAgentBonusContext = {
  userId: number;
  branch: string | null;
  trade_direction_id: number | null;
};
