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

import {
  orderScopeSql,
  planScopeSql,
  visitScopeSql,
  type SupervisorDashboardFilters,
  type SupervisorDashboardSnapshot,
  type SupervisorEfficiencyRow,
  type SupervisorKpi,
  type SupervisorProductMatrixBlock,
  type SupervisorProductMatrixRow,
  type SupervisorProductRow,
  type SupervisorVisitOutsideDetail,
  type SupervisorVisitPlanDetail,
  type SupervisorVisitRow
} from "./dashboard.supervisor.scope";
import { loadSupervisorProductAnalyticsBlocks } from "./dashboard.supervisor.snapshot-products";
import { loadSupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits";

export async function getSupervisorDashboardSnapshot(
  tenantId: number,
  filters: SupervisorDashboardFilters
): Promise<SupervisorDashboardSnapshot> {
  const snapshotKey = `tenant:${tenantId}:dashboard:supervisor:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SupervisorDashboardSnapshot>(snapshotKey);
  if (cached) return cached;

  const dayStart = new Date(`${filters.date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const weekday = ((dayStart.getUTCDay() + 6) % 7) + 1;
  const orderScope = orderScopeSql(tenantId, dayStart, dayEnd, filters);
  const visitScope = visitScopeSql(tenantId, dayStart, dayEnd, filters);
  const planScope = planScopeSql(tenantId, dayStart, dayEnd, weekday, filters);


  const { salesAgg, cashAgg, paymentBreakdownRows, mappedVisitRows, totals } =
    await loadSupervisorVisitAndSalesBlocks(
      tenantId,
      dayStart,
      dayEnd,
      filters,
      orderScope,
      visitScope,
      planScope
    );

  const { product_analytics, product_matrix } = await loadSupervisorProductAnalyticsBlocks(orderScope);

  const byAgents: SupervisorEfficiencyRow[] = mappedVisitRows.map((r) => ({
    id: r.agent_id,
    name: r.agent_name,
    order_count: r.visits_with_orders,
    cancelled_count: 0,
    planned_visits: r.planned_visits,
    visited_total: r.visited_total,
    rejected_visits: r.visits_without_orders,
    unvisited: r.not_visited,
    visit_pct: clampPct(r.planned_visits > 0 ? (r.visited_planned / r.planned_visits) * 100 : 0),
    photo_reports: r.photo_reports,
    total_sales_sum: r.sales_sum
  }));

  const supMap = new Map<number, SupervisorEfficiencyRow>();
  for (const row of mappedVisitRows) {
    if (row.supervisor_id == null) continue;
    const prev = supMap.get(row.supervisor_id) ?? {
      id: row.supervisor_id,
      name: row.supervisor_name ?? `Supervisor ${row.supervisor_id}`,
      order_count: 0,
      cancelled_count: 0,
      planned_visits: 0,
      visited_total: 0,
      rejected_visits: 0,
      unvisited: 0,
      visit_pct: 0,
      photo_reports: 0,
      total_sales_sum: "0"
    };
    prev.order_count += row.visits_with_orders;
    prev.planned_visits += row.planned_visits;
    prev.visited_total += row.visited_total;
    prev.rejected_visits += row.visits_without_orders;
    prev.unvisited += row.not_visited;
    prev.photo_reports += row.photo_reports;
    prev.total_sales_sum = new Prisma.Decimal(prev.total_sales_sum).plus(row.sales_sum).toFixed(2);
    supMap.set(row.supervisor_id, prev);
  }
  const bySupervisors = Array.from(supMap.values())
    .map((s) => ({
      ...s,
      visit_pct: clampPct(s.planned_visits > 0 ? ((s.planned_visits - s.unvisited) / s.planned_visits) * 100 : 0)
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const salesByPaymentMethod = paymentBreakdownRows.map((row) => ({
    method: row.method === "_" ? "" : row.method,
    sum: decToString(row.s)
  }));

  const kpi: SupervisorKpi = {
    total_sales_sum: decToString(salesAgg[0]?.s),
    cash_sales_sum: decToString(cashAgg[0]?.s),
    sales_by_payment_method: salesByPaymentMethod,
    planned_visits: totals.planned_visits,
    visited_planned: totals.visited_planned,
    visited_total: totals.visited_total,
    successful_visits: totals.visits_with_orders,
    gps_visits: totals.gps_visits,
    photo_reports: totals.photo_reports,
    visit_pct: clampPct(totals.planned_visits > 0 ? (totals.visited_planned / totals.planned_visits) * 100 : 0),
    success_pct: clampPct(totals.visited_total > 0 ? (totals.visits_with_orders / totals.visited_total) * 100 : 0),
    gps_pct: clampPct(totals.planned_visits > 0 ? (totals.gps_visits / totals.planned_visits) * 100 : 0),
    photo_pct: clampPct(totals.planned_visits > 0 ? (totals.photo_reports / totals.planned_visits) * 100 : 0)
  };


  const result: SupervisorDashboardSnapshot = {
    filters,
    kpi,
    product_analytics,
    product_matrix,
    visit_report: {
      rows: mappedVisitRows,
      totals
    },
    efficiency_report: {
      by_agents: byAgents,
      by_supervisors: bySupervisors
    }
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

