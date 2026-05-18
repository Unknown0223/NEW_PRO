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

export type SupervisorDashboardFilters = {
  date: string;
  /** `payment_type` query: vergul bilan ajratilgan `payment_method_ref` qiymatlari */
  payment_types: string[];
  agent_ids: number[];
  supervisor_ids: number[];
  trade_directions: string[];
  client_categories: string[];
  territory_1_list: string[];
  territory_2_list: string[];
  territory_3_list: string[];
  /** «Итоги визитов»: bo‘sh / undefined — `NOT IN (cancelled, returned)` (dashboard odatiy). */
  order_statuses?: string[];
};

export type SupervisorKpi = {
  total_sales_sum: string;
  cash_sales_sum: string;
  /** Kunlik savdo `payment_method_ref` bo‘yicha (filtrlangan orderScope). */
  sales_by_payment_method: Array<{ method: string; sum: string }>;
  planned_visits: number;
  visited_planned: number;
  visited_total: number;
  successful_visits: number;
  gps_visits: number;
  photo_reports: number;
  visit_pct: number;
  success_pct: number;
  gps_pct: number;
  photo_pct: number;
};

export type SupervisorProductRow = {
  dimension: string;
  share_pct: number;
  revenue: string;
  quantity: string;
  akb: number;
};

export type SupervisorProductMatrixValue = {
  revenue: string;
  quantity: string;
  akb: number;
  orders: number;
};

export type SupervisorProductMatrixRow = {
  id: number;
  name: string;
  values: Record<string, SupervisorProductMatrixValue>;
};

export type SupervisorProductMatrixBlock = {
  dimensions: string[];
  by_agents: SupervisorProductMatrixRow[];
  by_supervisors: SupervisorProductMatrixRow[];
};

/** «По плану» — rasmdagi katakchalar bilan mos. */
export type SupervisorVisitPlanDetail = {
  visited_order_sum: string;
  visited_order_qty: string;
  visited_no_order: number;
  not_visited_order_sum: string;
  not_visited_order_qty: string;
  photo: number;
};

/** «Вне плана». */
export type SupervisorVisitOutsideDetail = {
  visited_order_sum: string;
  visited_order_qty: string;
  visited_no_order: number;
  not_visited_order_sum: string;
  not_visited_order_qty: string;
  photo: number;
};

export type SupervisorVisitRow = {
  agent_id: number;
  agent_name: string;
  /** Agent kodi (UI: «01 - CODE - …») */
  agent_code: string | null;
  supervisor_id: number | null;
  supervisor_name: string | null;
  planned_visits: number;
  visited_planned: number;
  visited_unplanned: number;
  visited_total: number;
  not_visited: number;
  visits_with_orders: number;
  visits_without_orders: number;
  gps_visits: number;
  photo_reports: number;
  sales_sum: string;
  sales_qty: string;
  plan_detail: SupervisorVisitPlanDetail;
  outside_detail: SupervisorVisitOutsideDetail;
};

export type SupervisorEfficiencyRow = {
  id: number;
  name: string;
  order_count: number;
  cancelled_count: number;
  planned_visits: number;
  visited_total: number;
  rejected_visits: number;
  unvisited: number;
  visit_pct: number;
  photo_reports: number;
  total_sales_sum: string;
};

export type SupervisorDashboardSnapshot = {
  filters: SupervisorDashboardFilters;
  kpi: SupervisorKpi;
  product_analytics: {
    by_category: SupervisorProductRow[];
    by_group: SupervisorProductRow[];
    by_brand: SupervisorProductRow[];
  };
  product_matrix: {
    by_category: SupervisorProductMatrixBlock;
    by_group: SupervisorProductMatrixBlock;
    by_brand: SupervisorProductMatrixBlock;
  };
  visit_report: {
    rows: SupervisorVisitRow[];
    totals: Omit<SupervisorVisitRow, "agent_id" | "agent_name" | "supervisor_id" | "supervisor_name">;
  };
  efficiency_report: {
    by_agents: SupervisorEfficiencyRow[];
    by_supervisors: SupervisorEfficiencyRow[];
  };
};

export function parseSupervisorDashboardFilters(
  q: Record<string, string | undefined>
): SupervisorDashboardFilters {
  return {
    date: normalizeYmd(q.date),
    payment_types: csvToStringArray(q.payment_type),
    agent_ids: csvToIntArray(q.agent_ids),
    supervisor_ids: csvToIntArray(q.supervisor_ids),
    trade_directions: csvToStringArray(q.trade_direction),
    client_categories: csvToStringArray(q.client_category),
    territory_1_list: csvToStringArray(q.territory_1 ?? q.territory1),
    territory_2_list: csvToStringArray(q.territory_2 ?? q.territory2),
    territory_3_list: csvToStringArray(q.territory_3 ?? q.territory3)
  };
}

const ORDER_STATUS_FILTER_ALLOWLIST = new Set([
  "new",
  "confirmed",
  "picking",
  "delivering",
  "delivered",
  "returned",
  "cancelled",
  "return_processing"
]);

function orderStatusClauseForScope(f: SupervisorDashboardFilters): Prisma.Sql {
  const raw = (f.order_statuses ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const picked = [...new Set(raw.filter((s) => ORDER_STATUS_FILTER_ALLOWLIST.has(s)))];
  if (picked.length === 0) {
    return Prisma.sql`o.status NOT IN ('cancelled', 'returned')`;
  }
  return Prisma.sql`o.status IN (${Prisma.join(picked.map((s) => Prisma.sql`${s}`))})`;
}

/** Hisobotlar («Итоги визитов») bilan kunlik order/visit/plan filtri uchun eksport. */
export function orderScopeSql(tenantId: number, start: Date, end: Date, f: SupervisorDashboardFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`o.tenant_id = ${tenantId}`,
    Prisma.sql`o.created_at >= ${start}`,
    Prisma.sql`o.created_at < ${end}`,
    Prisma.sql`o.order_type = 'order'`,
    orderStatusClauseForScope(f)
  ];
  if (f.payment_types.length > 0) {
    parts.push(
      Prisma.sql`o.payment_method_ref IN (${Prisma.join(f.payment_types.map((p) => Prisma.sql`${p}`))})`
    );
  }
  if (f.agent_ids.length > 0) parts.push(Prisma.sql`o.agent_id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length > 0) parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  if (f.trade_directions.length > 0) {
    const pick = f.trade_directions.map((p) => Prisma.sql`${p}`);
    parts.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM trade_directions td
      WHERE td.tenant_id = ${tenantId}
        AND td.is_active = true
        AND (td.code IN (${Prisma.join(pick)}) OR td.name IN (${Prisma.join(pick)}))
        AND (
          u.trade_direction_id = td.id
          OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.code, ''))
          OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.name, ''))
        )
    )`);
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

export function visitScopeSql(tenantId: number, start: Date, end: Date, f: SupervisorDashboardFilters): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`av.tenant_id = ${tenantId}`,
    Prisma.sql`av.checked_in_at >= ${start}`,
    Prisma.sql`av.checked_in_at < ${end}`
  ];
  if (f.agent_ids.length > 0) parts.push(Prisma.sql`av.agent_id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length > 0) parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  if (f.trade_directions.length > 0) {
    const pick = f.trade_directions.map((p) => Prisma.sql`${p}`);
    parts.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM trade_directions td
      WHERE td.tenant_id = ${tenantId}
        AND td.is_active = true
        AND (td.code IN (${Prisma.join(pick)}) OR td.name IN (${Prisma.join(pick)}))
        AND (
          u.trade_direction_id = td.id
          OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.code, ''))
          OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.name, ''))
        )
    )`);
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

export function planScopeSql(
  tenantId: number,
  start: Date,
  end: Date,
  weekday: number,
  f: SupervisorDashboardFilters
): Prisma.Sql {
  const parts: Prisma.Sql[] = [
    Prisma.sql`caa.tenant_id = ${tenantId}`,
    /* Aniq sana — faqat shu kun; takrorlanuvchi — faqat visit_date bo‘sh (aks holda har hafta kuni uchun butun jadval «reja»ga tushib N² sekinlashadi). */
    Prisma.sql`(
      (caa.visit_date IS NOT NULL AND caa.visit_date >= ${start} AND caa.visit_date < ${end})
      OR (caa.visit_date IS NULL AND caa.visit_weekdays::jsonb @> ${JSON.stringify([weekday])}::jsonb)
    )`
  ];
  if (f.agent_ids.length > 0) parts.push(Prisma.sql`caa.agent_id IN (${Prisma.join(f.agent_ids)})`);
  if (f.supervisor_ids.length > 0) parts.push(Prisma.sql`u.supervisor_user_id IN (${Prisma.join(f.supervisor_ids)})`);
  if (f.trade_directions.length > 0) {
    const pick = f.trade_directions.map((p) => Prisma.sql`${p}`);
    parts.push(Prisma.sql`EXISTS (
      SELECT 1
      FROM trade_directions td
      WHERE td.tenant_id = ${tenantId}
        AND td.is_active = true
        AND (td.code IN (${Prisma.join(pick)}) OR td.name IN (${Prisma.join(pick)}))
        AND (
          u.trade_direction_id = td.id
          OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.code, ''))
          OR btrim(COALESCE(u.trade_direction, '')) = btrim(COALESCE(td.name, ''))
        )
    )`);
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
