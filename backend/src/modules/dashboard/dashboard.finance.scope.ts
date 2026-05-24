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
import type { FinanceDashboardFilters } from "./dashboard.finance.types";

export function normalizeFromYmd(input?: string): string {
  const t = (input ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
}

export function normalizeToYmd(input?: string): string {
  const t = (input ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return new Date().toISOString().slice(0, 10);
}

export function parseFinanceDashboardFilters(
  q: Record<string, string | undefined>
): FinanceDashboardFilters {
  const statusesRaw = csvToStringArray(q.statuses);
  const allowedStatuses = new Set<string>(ORDER_STATUSES);
  const statuses = statusesRaw.filter((s) => allowedStatuses.has(s));
  const date_type = q.date_type === "delivered_at" ? "delivered_at" : "created_at";
  return {
    date_type,
    from: normalizeFromYmd(q.from),
    to: normalizeToYmd(q.to),
    payment_types: csvToStringArray(q.payment_type),
    agent_ids: csvToIntArray(q.agent_ids),
    supervisor_ids: csvToIntArray(q.supervisor_ids),
    trade_directions: csvToStringArray(q.trade_direction),
    client_categories: csvToStringArray(q.client_category),
    category_ids: csvToIntArray(q.category_ids),
    territory_1_list: csvToStringArray(q.territory_1 ?? q.territory1),
    territory_2_list: csvToStringArray(q.territory_2 ?? q.territory2),
    territory_3_list: csvToStringArray(q.territory_3 ?? q.territory3),
    statuses
  };
}

type FinanceOrderScopeAliases = { order?: string; user?: string; client?: string };

function financeOrderAliases(opts?: { aliases?: FinanceOrderScopeAliases }): {
  o: string;
  u: string;
  c: string;
} {
  return {
    o: opts?.aliases?.order ?? "o",
    u: opts?.aliases?.user ?? "u",
    c: opts?.aliases?.client ?? "c"
  };
}

export function financeDateExprByType(
  dateType: FinanceDashboardFilters["date_type"],
  orderAlias = "o"
): Prisma.Sql {
  if (dateType === "delivered_at") {
    return Prisma.raw(
      `COALESCE((SELECT MIN(sl.created_at) FROM order_status_logs sl WHERE sl.order_id = ${orderAlias}.id AND sl.to_status IN ('delivering', 'delivered')), ${orderAlias}.updated_at)`
    );
  }
  return Prisma.raw(`${orderAlias}.created_at`);
}

export function financeOrderScopeSql(
  tenantId: number,
  start: Date,
  end: Date,
  f: FinanceDashboardFilters,
  opts?: { onlyReceivableStatuses?: boolean; aliases?: FinanceOrderScopeAliases }
): Prisma.Sql {
  const { o, u, c } = financeOrderAliases(opts);
  const dateExpr = financeDateExprByType(f.date_type, o);
  const parts: Prisma.Sql[] = [
    Prisma.sql`${Prisma.raw(`${o}.tenant_id`)} = ${tenantId}`,
    Prisma.sql`${Prisma.raw(`${o}.order_type`)} = 'order'`,
    Prisma.sql`${dateExpr} >= ${start}`,
    Prisma.sql`${dateExpr} <= ${end}`
  ];
  if (opts?.onlyReceivableStatuses) {
    parts.push(
      Prisma.sql`${Prisma.raw(`${o}.status`)} IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})`
    );
  } else {
    parts.push(Prisma.sql`${Prisma.raw(`${o}.status`)} NOT IN ('cancelled', 'returned')`);
  }
  if (f.statuses.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${o}.status`)} IN (${Prisma.join(f.statuses)})`);
  }
  if (f.payment_types.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(${Prisma.raw(`${o}.payment_method_ref`)}, '')) IN (${Prisma.join(
        f.payment_types.map((p) => Prisma.sql`${p}`)
      )})`
    );
  }
  if (f.agent_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${o}.agent_id`)} IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.supervisor_ids.length > 0) {
    parts.push(Prisma.sql`${Prisma.raw(`${u}.supervisor_user_id`)} IN (${Prisma.join(f.supervisor_ids)})`);
  }
  if (f.trade_directions.length > 0) {
    const pick = f.trade_directions.map((p) => Prisma.sql`${p}`);
    parts.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM trade_directions td
      WHERE td.tenant_id = ${tenantId}
        AND td.is_active = true
        AND (td.code IN (${Prisma.join(pick)}) OR td.name IN (${Prisma.join(pick)}))
        AND (
          ${Prisma.raw(`${u}.trade_direction_id`)} = td.id
          OR btrim(COALESCE(${Prisma.raw(`${u}.trade_direction`)}, '')) = btrim(COALESCE(td.code, ''))
          OR btrim(COALESCE(${Prisma.raw(`${u}.trade_direction`)}, '')) = btrim(COALESCE(td.name, ''))
        )
    )`);
  }
  if (f.client_categories.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(${Prisma.raw(`${c}.category`)}, '')) IN (${Prisma.join(f.client_categories.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_1_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(${Prisma.raw(`${c}.zone`)}, '')) IN (${Prisma.join(f.territory_1_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_2_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(${Prisma.raw(`${c}.region`)}, '')) IN (${Prisma.join(f.territory_2_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.territory_3_list.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(${Prisma.raw(`${c}.city`)}, '')) IN (${Prisma.join(f.territory_3_list.map((p) => Prisma.sql`${p}`))})`
    );
  }
  const productExists = financeProductExistsClause(f, o);
  if (productExists !== Prisma.empty) parts.push(productExists);
  return Prisma.join(parts, " AND ");
}

/** Mahsulot kategoriyasi (order_items → products.category_id). */
export function financeProductExistsClause(
  f: FinanceDashboardFilters,
  orderAlias = "o"
): Prisma.Sql {
  if (f.category_ids.length === 0) return Prisma.empty;
  return Prisma.sql`EXISTS (
    SELECT 1
    FROM order_items oi_f
    JOIN products p_f ON p_f.id = oi_f.product_id
    WHERE oi_f.order_id = ${Prisma.raw(`${orderAlias}.id`)}
      AND p_f.category_id IN (${Prisma.join(f.category_ids)})
  )`;
}

export function financeClientFilterSql(tenantId: number, f: FinanceDashboardFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (f.agent_ids.length > 0) {
    parts.push(Prisma.sql`c.agent_id IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.supervisor_ids.length > 0) {
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users ux
        WHERE ux.id = c.agent_id AND ux.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})
      )`
    );
  }
  if (f.trade_directions.length > 0) {
    const pick = f.trade_directions.map((p) => Prisma.sql`${p}`);
    parts.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM users ux
        JOIN trade_directions td ON td.tenant_id = ${tenantId} AND td.is_active = true
        WHERE ux.id = c.agent_id
          AND (td.code IN (${Prisma.join(pick)}) OR td.name IN (${Prisma.join(pick)}))
          AND (
            ux.trade_direction_id = td.id
            OR btrim(COALESCE(ux.trade_direction, '')) = btrim(COALESCE(td.code, ''))
            OR btrim(COALESCE(ux.trade_direction, '')) = btrim(COALESCE(td.name, ''))
          )
      )`
    );
  }
  if (f.client_categories.length > 0) {
    parts.push(
      Prisma.sql`btrim(COALESCE(c.category, '')) IN (${Prisma.join(f.client_categories.map((p) => Prisma.sql`${p}`))})`
    );
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
  return Prisma.join(parts, " AND ");
}
