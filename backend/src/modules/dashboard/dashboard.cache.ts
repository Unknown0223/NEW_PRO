/**
 * Domain: Dashboard (supervisor / sales / finance snapshot).
 * Boundary: route → filter parse + RBAC scope; servis → Prisma agregatlar + Redis cache (`DASHBOARD_CACHE_TTL`).
 * Bog‘liq: `dashboard.route.ts`, `recordDashboardPerf`, `docs/domain-boundary.md`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { getRedisForApp } from "../../lib/redis-cache";
import {
  ORDER_STATUSES,
  ORDER_STATUSES_OUTSTANDING_RECEIVABLE
} from "../orders/order-status";


export function dashboardCacheKey(tenantId: number): string {
  return `tenant:${tenantId}:dashboard`;
}

export function stableJsonStringify(value: unknown): string {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(obj[k])}`).join(",")}}`;
}

export async function getSnapshotCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function setSnapshotCache(key: string, value: unknown): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await redis.set(key, JSON.stringify(value), "EX", env.DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS);
  } catch {
    /* ignore */
  }
}

export function startOfTodayUtc(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function endOfTodayUtc(): Date {
  const s = startOfTodayUtc();
  return new Date(s.getTime() + 86400000);
}

export type DashboardStatsRow = {
  day_utc: string;
  orders_today: number;
  orders_active: number;
  payments_today: number;
  payments_sum_today: string;
  returns_today: number;
  clients_total: number;
  products_active: number;
  /** Yetkazilgan savdo zakazlari bo‘yicha to‘lanmagan qoldiq (taqsimlar bilan) */
  open_orders_total: string;
};

export async function getDashboardStats(tenantId: number): Promise<DashboardStatsRow> {
  // ✅ Redis cache tekshirish
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(dashboardCacheKey(tenantId));
    if (cached) {
      return JSON.parse(cached) as DashboardStatsRow;
    }
  } catch {
    /* Redis yo'q — to'g'ridan hisoblash */
  }

  const start = startOfTodayUtc();
  const end = endOfTodayUtc();
  const activeStatuses = ["new", "confirmed", "picking", "delivering"];

  const [
    orders_today,
    orders_active,
    payments_today,
    paySum,
    returns_today,
    clients_total,
    products_active
  ] = await Promise.all([
    prisma.order.count({
      where: { tenant_id: tenantId, created_at: { gte: start, lt: end } }
    }),
    prisma.order.count({
      where: { tenant_id: tenantId, status: { in: activeStatuses } }
    }),
    prisma.payment.count({
      where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: start, lt: end } }
    }),
    prisma.payment.aggregate({
      where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: start, lt: end } },
      _sum: { amount: true }
    }),
    prisma.salesReturn.count({
      where: { tenant_id: tenantId, status: "posted", created_at: { gte: start, lt: end } }
    }),
    prisma.client.count({
      where: { tenant_id: tenantId, merged_into_client_id: null, is_active: true }
    }),
    prisma.product.count({ where: { tenant_id: tenantId, is_active: true } })
  ]);

  const [deliveredUnpaidRow] = await prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::decimal(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    )
    SELECT COALESCE(
      SUM(GREATEST(o.total_sum - COALESCE(a.sum_amt, 0), 0)),
      0
    )::decimal(15,2) AS s
    FROM orders o
    LEFT JOIN alloc a ON a.order_id = o.id
    WHERE o.tenant_id = ${tenantId}
      AND o.order_type = 'order'
      AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
  `;

  const result: DashboardStatsRow = {
    day_utc: start.toISOString().slice(0, 10),
    orders_today,
    orders_active,
    payments_today,
    payments_sum_today: (paySum._sum.amount ?? new Prisma.Decimal(0)).toString(),
    returns_today,
    clients_total,
    products_active,
    open_orders_total: (deliveredUnpaidRow?.s ?? new Prisma.Decimal(0)).toString()
  };

  // ✅ Redis cache saqlash
  try {
    const redis = await getRedisForApp();
    await setSnapshotCache(dashboardCacheKey(tenantId), result);
  } catch {
    /* ignore */
  }

  return result;
}

