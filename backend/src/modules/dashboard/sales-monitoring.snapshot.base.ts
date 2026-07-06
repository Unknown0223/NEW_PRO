import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import { loadActiveBranchNames } from "../tenant-settings/tenant-settings.refs";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";
import {
  monthBoundsUtc,
  monitoringAllClientsScope,
  monitoringOrdersScopeAllStatuses,
  monitoringSalesScope,
  resolveSalesTerritoryTerms
} from "./sales-monitoring.scope";
import { loadMonitoringPlanAggregatesForFilters, monitoringPlanNote } from "../plans/plans.monitoring-aggregates";
import type { MonitoringPlanAggregates } from "../plans/plans.monitoring-aggregates";

export type SalesMonitoringBuildBase = {
  tenantId: number;
  filters: SalesMonitoringFilters;
  fromYmd: string;
  toYmd: string;
  salesScope: Prisma.Sql;
  allClientScope: Prisma.Sql;
  skuScope: Prisma.Sql;
  prevYearSalesScope: Prisma.Sql;
  returnLossScope: Prisma.Sql;
  factSales: string;
  curOrd: number;
  deliveredOrd: number;
  planSales: string;
  planNum: number;
  factNum: number;
  execution_pct: number | null;
  akb: number;
  okb: number;
  coverage_pct: number;
  growth_vs_prev_month_sales_pct: number | null;
  activeTerritoryKeys: number;
  returnLossSum: string;
  payment_method_options: string[];
  forecast_month_end_sales: string | null;
  aov: string;
  order_success_pct: number | null;
  branch_options: string[];
  agg0: { s: Prisma.Decimal; orders_count: bigint; delivered_orders: bigint } | undefined;
  planAggregates: MonitoringPlanAggregates;
  plan_note: string;
};

export async function buildSalesMonitoringBase(
  tenantId: number,
  filters: SalesMonitoringFilters
): Promise<SalesMonitoringBuildBase> {
  const { from, to, fromYmd, toYmd } = monthBoundsUtc(filters.year, filters.month);
  const territoryTerms = await resolveSalesTerritoryTerms(tenantId, filters.territory_ids);
  const salesScope = monitoringSalesScope(tenantId, from, to, filters, territoryTerms);
  const allClientScope = monitoringAllClientsScope(tenantId, filters, territoryTerms);
  const skuScope = monitoringOrdersScopeAllStatuses(tenantId, from, to, filters, territoryTerms);
  const prevYearBounds = monthBoundsUtc(filters.year - 1, filters.month);
  const prevYearSalesScope = monitoringSalesScope(
    tenantId,
    prevYearBounds.from,
    prevYearBounds.to,
    filters,
    territoryTerms
  );

  const branch_options = await loadActiveBranchNames(tenantId);

  const returnLossScope = monitoringSalesScope(tenantId, from, to, filters, territoryTerms, {
    returnedOrdersOnly: true
  });
  let prevCalMonth = filters.month - 1;
  let prevCalYear = filters.year;
  if (prevCalMonth < 1) {
    prevCalMonth = 12;
    prevCalYear -= 1;
  }
  const prevCalBounds = monthBoundsUtc(prevCalYear, prevCalMonth);
  const prevCalSalesScope = monitoringSalesScope(tenantId, prevCalBounds.from, prevCalBounds.to, filters, territoryTerms);

  const [baseRows] = await prisma.$queryRaw<Array<{
    s: Prisma.Decimal;
    orders_count: bigint;
    delivered_orders: bigint;
    akb_count: bigint;
    okb_count: bigint;
    prev_s: Prisma.Decimal;
    territory_count: bigint;
    loss_s: Prisma.Decimal;
    payment_refs: string[];
  }>>`
    WITH base_orders AS (
      SELECT o.id, o.client_id, o.status, o.total_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${salesScope}
    ),
    prev_orders AS (
      SELECT o.id, o.total_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${prevCalSalesScope}
    ),
    -- Main aggregation
    agg AS (
      SELECT 
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS s,
        COUNT(DISTINCT o.id)::bigint AS orders_count,
        COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END)::bigint AS delivered_orders
      FROM base_orders o
      JOIN order_items oi ON oi.order_id = o.id
    ),
    -- AKB (active buying clients)
    akb AS (
      SELECT COUNT(DISTINCT o.client_id)::bigint AS c
      FROM base_orders o
    ),
    -- OKB (organized clients)
    okb AS (
      SELECT COUNT(DISTINCT caa.client_id)::bigint AS c
      FROM client_agent_assignments caa
      JOIN clients c ON c.id = caa.client_id
      JOIN users u ON u.id = caa.agent_id
      WHERE ${allClientScope}
    ),
    -- Previous month sales
    prev_month AS (
      SELECT COALESCE(SUM(oi.total), 0)::numeric(15,2) AS s
      FROM prev_orders o
      JOIN order_items oi ON oi.order_id = o.id
    ),
    -- Territory count
    territory_count AS (
      SELECT COUNT(DISTINCT (
        COALESCE(NULLIF(TRIM(c.zone), ''), '-') || '|' ||
        COALESCE(NULLIF(TRIM(c.region), ''), '-') || '|' ||
        COALESCE(NULLIF(TRIM(c.city), ''), '-')
      ))::bigint AS n
      FROM base_orders o
      JOIN clients c ON c.id = o.client_id
    ),
    -- Return/loss
    loss AS (
      SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS s
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${returnLossScope}
    ),
    -- Payment methods
    payment_refs AS (
      SELECT ARRAY_AGG(DISTINCT TRIM(o.payment_method_ref)) FILTER (WHERE o.payment_method_ref IS NOT NULL AND TRIM(o.payment_method_ref) <> '') AS refs
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.payment_method_ref IS NOT NULL
        AND TRIM(o.payment_method_ref) <> ''
    )
    SELECT 
      (SELECT s FROM agg) AS s,
      (SELECT orders_count FROM agg) AS orders_count,
      (SELECT delivered_orders FROM agg) AS delivered_orders,
      (SELECT c FROM akb) AS akb_count,
      (SELECT c FROM okb) AS okb_count,
      (SELECT s FROM prev_month) AS prev_s,
      (SELECT n FROM territory_count) AS territory_count,
      (SELECT s FROM loss) AS loss_s,
      COALESCE((SELECT refs FROM payment_refs), ARRAY[]::text[]) AS payment_refs
  `;
  const agg0 = baseRows;
  const planAggregates = await loadMonitoringPlanAggregatesForFilters(tenantId, filters, territoryTerms);
  const factSales = decToString(agg0?.s ?? 0);
  const curOrd = Number(agg0?.orders_count ?? 0n);
  const deliveredOrd = Number(agg0?.delivered_orders ?? 0n);
  const planSales = decToString(planAggregates.total);
  const planNum = Number(planSales);
  const factNum = Number(factSales);
  const execution_pct =
    planNum > 0 && Number.isFinite(factNum) ? clampPct((factNum / planNum) * 100) : null;

  const akb = Number(agg0?.akb_count ?? 0n);
  const okb = Number(agg0?.okb_count ?? 0n);
  const coverage_pct = okb > 0 ? clampPct((akb / okb) * 100) : 0;

  const prevMonthSalesNum = Number(decToString(agg0?.prev_s ?? 0));
  const growth_vs_prev_month_sales_pct =
    !Number.isFinite(factNum) || !Number.isFinite(prevMonthSalesNum)
      ? null
      : prevMonthSalesNum === 0
        ? factNum > 0
          ? 100
          : 0
        : clampPct(((factNum - prevMonthSalesNum) / prevMonthSalesNum) * 100);
  const activeTerritoryKeys = Number(agg0?.territory_count ?? 0n);
  const returnLossSum = decToString(agg0?.loss_s ?? 0);
  const payment_method_options = (agg0?.payment_refs ?? []).filter(Boolean);

  const now = new Date();
  const isCurrentMonth =
    now.getUTCFullYear() === filters.year && now.getUTCMonth() + 1 === filters.month;
  const lastDay = new Date(Date.UTC(filters.year, filters.month, 0)).getUTCDate();
  const dayProgress = Math.min(lastDay, Math.max(1, now.getUTCDate()));
  const forecast_month_end_sales =
    isCurrentMonth && dayProgress > 0 && Number.isFinite(factNum)
      ? decToString(Math.round(((factNum / dayProgress) * lastDay + Number.EPSILON) * 100) / 100)
      : null;
  const aov =
    curOrd > 0 && Number.isFinite(factNum)
      ? decToString(Math.round((factNum / curOrd + Number.EPSILON) * 100) / 100)
      : "0";
  const order_success_pct = curOrd > 0 ? clampPct((deliveredOrd / curOrd) * 100) : null;
  return {
    tenantId,
    filters,
    fromYmd,
    toYmd,
    salesScope,
    allClientScope,
    skuScope,
    prevYearSalesScope,
    returnLossScope,
    factSales,
    curOrd,
    deliveredOrd,
    planSales,
    planNum,
    factNum,
    execution_pct,
    akb,
    okb,
    coverage_pct,
    growth_vs_prev_month_sales_pct,
    activeTerritoryKeys,
    returnLossSum,
    payment_method_options,
    forecast_month_end_sales,
    aov,
    order_success_pct,
    branch_options,
    agg0,
    planAggregates,
    plan_note: monitoringPlanNote(planAggregates.hasApprovedPlans)
  };
}
