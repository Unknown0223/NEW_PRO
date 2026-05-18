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

import {
  dashboardCacheKey,
  endOfTodayUtc,
  getSnapshotCache,
  setSnapshotCache,
  startOfTodayUtc,
  stableJsonStringify
} from "./dashboard.cache";
import {
  bigToNum,
  clampPct,
  csvToIntArray,
  csvToStringArray,
  decToString,
  nonEmpty,
  normalizeYmd
} from "./dashboard.helpers";

import type { SalesDashboardFilters } from "./dashboard.sales.types";
import { normalizeFromYmd, normalizeToYmd } from "./dashboard.finance";

export function normalizeSalesDateType(input?: string): SalesDashboardFilters["date_type"] {
  return input === "shipment_date" ? "shipment_date" : "order_date";
}

export function csvToTextArray(input?: string): string[] {
  if (!input) return [];
  const set = new Set<string>();
  for (const p of input.split(",")) {
    const t = p.trim();
    if (t) set.add(t);
  }
  return [...set];
}

export function parseSalesDashboardFilters(q: Record<string, string | undefined>): SalesDashboardFilters {
  const statusRaw = csvToTextArray(q.status ?? q.statuses);
  const allowedStatus = new Set<string>(ORDER_STATUSES);
  return {
    date_type: normalizeSalesDateType(q.date_type),
    from: normalizeFromYmd(q.from),
    to: normalizeToYmd(q.to),
    status: statusRaw.filter((s) => allowedStatus.has(s)),
    category_ids: csvToIntArray(q.category_ids),
    manufacturer_ids: csvToIntArray(q.manufacturer_ids),
    supervisor_ids: csvToIntArray(q.supervisor_ids),
    group_ids: csvToIntArray(q.group_ids),
    brand_ids: csvToIntArray(q.brand_ids),
    territory_ids: csvToIntArray(q.territory_ids),
    territory_1_list: csvToTextArray(q.territory_1 ?? q.territory1),
    territory_2_list: csvToTextArray(q.territory_2 ?? q.territory2),
    territory_3_list: csvToTextArray(q.territory_3 ?? q.territory3),
    payment_types: csvToTextArray(q.payment_types),
    trade_directions: csvToTextArray(q.trade_direction ?? q.trade_directions)
  };
}

export function salesDateExprByType(dateType: SalesDashboardFilters["date_type"]): Prisma.Sql {
  if (dateType === "shipment_date") {
    return Prisma.raw(
      "COALESCE((SELECT MIN(sl.created_at) FROM order_status_logs sl WHERE sl.order_id = o.id AND sl.to_status IN ('delivering', 'delivered')), o.updated_at)"
    );
  }
  return Prisma.raw("o.created_at");
}

export function buildSalesTerritoryAliasClause(alias: string, terms: string[]): Prisma.Sql {
  if (terms.length === 0) return Prisma.empty;
  const vals = Prisma.join(terms.map((t) => Prisma.sql`${t}`));
  return Prisma.sql`AND (
    COALESCE(${Prisma.raw(`${alias}.region`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.city`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.district`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.zone`)}, '') IN (${vals})
    OR COALESCE(${Prisma.raw(`${alias}.neighborhood`)}, '') IN (${vals})
  )`;
}

export function salesProductExistsClause(f: SalesDashboardFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.category_ids.length > 0) {
    parts.push(Prisma.sql`px.category_id IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.group_ids.length > 0) {
    parts.push(Prisma.sql`px.product_group_id IN (${Prisma.join(f.group_ids)})`);
  }
  if (f.brand_ids.length > 0) {
    parts.push(Prisma.sql`px.brand_id IN (${Prisma.join(f.brand_ids)})`);
  }
  if (f.manufacturer_ids.length > 0) {
    parts.push(Prisma.sql`px.manufacturer_id IN (${Prisma.join(f.manufacturer_ids)})`);
  }
  if (parts.length === 0) return Prisma.empty;
  const inner = Prisma.join(parts, " AND ");
  return Prisma.sql`AND EXISTS (
    SELECT 1
    FROM order_items oix
    JOIN products px ON px.id = oix.product_id
    WHERE oix.order_id = o.id
      AND ${inner}
  )`;
}

export function salesOrderScopeSql(
  tenantId: number,
  from: Date,
  to: Date,
  f: SalesDashboardFilters,
  territoryTerms: string[],
  opts?: { forSales?: boolean }
): Prisma.Sql {
  const dateExpr = salesDateExprByType(f.date_type);
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.order_type = 'order'`,
    Prisma.sql`${dateExpr} >= ${from}`,
    Prisma.sql`${dateExpr} <= ${to}`
  ];
  if (f.status.length > 0) {
    parts.push(Prisma.sql`o.status IN (${Prisma.join(f.status)})`);
  } else if (opts?.forSales !== false) {
    parts.push(Prisma.sql`o.status NOT IN ('cancelled', 'returned')`);
  }
  if (f.payment_types.length > 0) {
    parts.push(Prisma.sql`COALESCE(o.payment_method_ref, '') IN (${Prisma.join(f.payment_types)})`);
  }
  if (f.supervisor_ids.length > 0) {
    parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  }
  if (f.trade_directions.length > 0) {
    parts.push(Prisma.sql`COALESCE(u.trade_direction, '') IN (${Prisma.join(f.trade_directions)})`);
  }
  if (f.territory_1_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.zone, '')) IN (${Prisma.join(f.territory_1_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_2_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.region, '')) IN (${Prisma.join(f.territory_2_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_3_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.city, '')) IN (${Prisma.join(f.territory_3_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  const base = Prisma.join(parts, " AND ");
  const territoryClause = buildSalesTerritoryAliasClause("c", territoryTerms);
  const productClause = salesProductExistsClause(f);
  return Prisma.sql`${base} ${territoryClause} ${productClause}`;
}

export function salesProductJoinFilter(alias: string, f: SalesDashboardFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  if (f.category_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${alias}.category_id`)} IN (${Prisma.join(f.category_ids)})`);
  }
  if (f.group_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${alias}.product_group_id`)} IN (${Prisma.join(f.group_ids)})`);
  }
  if (f.brand_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${alias}.brand_id`)} IN (${Prisma.join(f.brand_ids)})`);
  }
  if (f.manufacturer_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${alias}.manufacturer_id`)} IN (${Prisma.join(f.manufacturer_ids)})`);
  }
  if (parts.length === 0) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, " AND ")}`;
}

export async function resolveSalesTerritoryTerms(tenantId: number, territoryIds: number[]): Promise<string[]> {
  if (territoryIds.length === 0) return [];
  const rows = await prisma.territory.findMany({
    where: { tenant_id: tenantId, id: { in: territoryIds }, deleted_at: null },
    select: { name: true, code: true }
  });
  const set = new Set<string>();
  for (const r of rows) {
    const name = r.name?.trim();
    const code = r.code?.trim();
    if (name) set.add(name);
    if (code) set.add(code);
  }
  return [...set];
}
