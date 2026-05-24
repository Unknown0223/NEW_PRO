import { Prisma } from "@prisma/client";
import { clampPct, decToString } from "./dashboard.helpers";
import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
import type {
  SupervisorDashboardFilters,
  SupervisorEfficiencyRow,
  SupervisorKpi,
  SupervisorProductMatrixBlock,
  SupervisorProductRow,
  SupervisorVisitRow
} from "./dashboard.supervisor.scope";
import { orderScopeSql, planScopeSql, visitScopeSql } from "./dashboard.supervisor.scope";
import { loadSupervisorProductAnalyticsBlocks } from "./dashboard.supervisor.snapshot-products";
import { loadSupervisorVisitAndSalesBlocks } from "./dashboard.supervisor.snapshot-visits";

async function buildSupervisorScopes(tenantId: number, filters: SupervisorDashboardFilters) {
  const dayStart = new Date(`${filters.date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 86400000);
  const weekday = ((dayStart.getUTCDay() + 6) % 7) + 1;
  return {
    dayStart,
    dayEnd,
    orderScope: orderScopeSql(tenantId, dayStart, dayEnd, filters),
    visitScope: visitScopeSql(tenantId, dayStart, dayEnd, filters),
    planScope: planScopeSql(tenantId, dayStart, dayEnd, weekday, filters)
  };
}

function buildEfficiencyReport(mappedVisitRows: Awaited<ReturnType<typeof loadSupervisorVisitAndSalesBlocks>>["mappedVisitRows"]) {
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

  return { by_agents: byAgents, by_supervisors: bySupervisors };
}

function buildKpi(
  salesAgg: Awaited<ReturnType<typeof loadSupervisorVisitAndSalesBlocks>>["salesAgg"],
  cashAgg: Awaited<ReturnType<typeof loadSupervisorVisitAndSalesBlocks>>["cashAgg"],
  paymentBreakdownRows: Awaited<ReturnType<typeof loadSupervisorVisitAndSalesBlocks>>["paymentBreakdownRows"],
  totals: Awaited<ReturnType<typeof loadSupervisorVisitAndSalesBlocks>>["totals"]
): SupervisorKpi {
  const salesByPaymentMethod = paymentBreakdownRows.map((row) => ({
    method: row.method === "_" ? "" : row.method,
    sum: decToString(row.s)
  }));
  return {
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
}

export type SupervisorSummaryPayload = {
  filters: SupervisorDashboardFilters;
  kpi: SupervisorKpi;
  visit_totals: Awaited<ReturnType<typeof loadSupervisorVisitAndSalesBlocks>>["totals"];
  efficiency_report: { by_agents: SupervisorEfficiencyRow[]; by_supervisors: SupervisorEfficiencyRow[] };
};

export type SupervisorVisitsPayload = {
  filters: SupervisorDashboardFilters;
  visit_report: { rows: SupervisorVisitRow[]; totals: SupervisorSummaryPayload["visit_totals"] };
  total: number;
  page: number;
  limit: number;
};

export type SupervisorProductsPayload = {
  filters: SupervisorDashboardFilters;
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
};

export async function getSupervisorSummary(
  tenantId: number,
  filters: SupervisorDashboardFilters
): Promise<SupervisorSummaryPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:supervisor:summary:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SupervisorSummaryPayload>(snapshotKey);
  if (cached) return cached;

  const scopes = await buildSupervisorScopes(tenantId, filters);
  const { salesAgg, cashAgg, paymentBreakdownRows, mappedVisitRows, totals } =
    await loadSupervisorVisitAndSalesBlocks(
      tenantId,
      scopes.dayStart,
      scopes.dayEnd,
      filters,
      scopes.orderScope,
      scopes.visitScope,
      scopes.planScope
    );

  const result: SupervisorSummaryPayload = {
    filters,
    kpi: buildKpi(salesAgg, cashAgg, paymentBreakdownRows, totals),
    visit_totals: totals,
    efficiency_report: buildEfficiencyReport(mappedVisitRows)
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

export async function getSupervisorVisits(
  tenantId: number,
  filters: SupervisorDashboardFilters,
  opts: { page?: number; limit?: number } = {}
): Promise<SupervisorVisitsPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const snapshotKey = `tenant:${tenantId}:dashboard:supervisor:visits:${stableJsonStringify({ filters, page, limit })}`;
  const cached = await getSnapshotCache<SupervisorVisitsPayload>(snapshotKey);
  if (cached) return cached;

  const scopes = await buildSupervisorScopes(tenantId, filters);
  const { mappedVisitRows, totals } = await loadSupervisorVisitAndSalesBlocks(
    tenantId,
    scopes.dayStart,
    scopes.dayEnd,
    filters,
    scopes.orderScope,
    scopes.visitScope,
    scopes.planScope
  );
  const offset = (page - 1) * limit;
  const rows = mappedVisitRows.slice(offset, offset + limit);

  const result: SupervisorVisitsPayload = {
    filters,
    visit_report: { rows, totals },
    total: mappedVisitRows.length,
    page,
    limit
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

export async function getSupervisorProducts(
  tenantId: number,
  filters: SupervisorDashboardFilters
): Promise<SupervisorProductsPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:supervisor:products:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SupervisorProductsPayload>(snapshotKey);
  if (cached) return cached;

  const scopes = await buildSupervisorScopes(tenantId, filters);
  const { product_analytics, product_matrix } = await loadSupervisorProductAnalyticsBlocks(scopes.orderScope);

  const result: SupervisorProductsPayload = { filters, product_analytics, product_matrix };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
