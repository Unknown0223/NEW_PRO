import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";
import {
  monthBoundsUtc,
  monitoringAllClientsScope,
  monitoringOrdersScopeAllStatuses,
  monitoringSalesScope,
  resolveSalesTerritoryTerms
} from "./sales-monitoring.scope";

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

  const branchRows = await prisma.user.groupBy({
    by: ["branch"],
    where: {
      tenant_id: tenantId,
      role: "agent",
      is_active: true,
      branch: { not: null }
    },
    _count: true
  });
  const branch_options = branchRows
    .map((r) => (r.branch ?? "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ru"));

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

  const [
    aggRows,
    akbRows,
    okbRows,
    prevMonthSalesRows,
    territoryKeyRows,
    lossRows,
    paymentRefRows
  ] = await Promise.all([
    prisma.$queryRaw<
      Array<{ s: Prisma.Decimal; orders_count: bigint; delivered_orders: bigint }>
    >`
      SELECT
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS s,
        COUNT(DISTINCT o.id)::bigint AS orders_count,
        COUNT(DISTINCT CASE WHEN o.status = 'delivered' THEN o.id END)::bigint AS delivered_orders
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${salesScope}
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT o.client_id)::bigint AS c
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${salesScope}
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT caa.client_id)::bigint AS c
      FROM client_agent_assignments caa
      JOIN clients c ON c.id = caa.client_id
      JOIN users u ON u.id = caa.agent_id
      WHERE ${allClientScope}
    `,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(oi.total), 0)::numeric(15,2) AS s
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${prevCalSalesScope}
    `,
    prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(DISTINCT (
        COALESCE(NULLIF(TRIM(c.zone), ''), '-') || '|' ||
        COALESCE(NULLIF(TRIM(c.region), ''), '-') || '|' ||
        COALESCE(NULLIF(TRIM(c.city), ''), '-')
      ))::bigint AS n
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${salesScope}
    `,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS s
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${returnLossScope}
    `,
    prisma.$queryRaw<Array<{ ref: string }>>`
      SELECT DISTINCT COALESCE(TRIM(o.payment_method_ref), '') AS ref
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.payment_method_ref IS NOT NULL
        AND TRIM(o.payment_method_ref) <> ''
      ORDER BY 1
      LIMIT 40
    `
  ]);
  const agg0 = aggRows[0];
  const factSales = decToString(agg0?.s ?? 0);
  const curOrd = Number(agg0?.orders_count ?? 0n);
  const deliveredOrd = Number(agg0?.delivered_orders ?? 0n);
  const planSales = "0";
  const planNum = Number(planSales);
  const factNum = Number(factSales);
  const execution_pct =
    planNum > 0 && Number.isFinite(factNum) ? clampPct((factNum / planNum) * 100) : null;

  const akb = Number(akbRows[0]?.c ?? 0n);
  const okb = Number(okbRows[0]?.c ?? 0n);
  const coverage_pct = okb > 0 ? clampPct((akb / okb) * 100) : 0;

  const prevMonthSalesNum = Number(decToString(prevMonthSalesRows[0]?.s ?? 0));
  const growth_vs_prev_month_sales_pct =
    !Number.isFinite(factNum) || !Number.isFinite(prevMonthSalesNum)
      ? null
      : prevMonthSalesNum === 0
        ? factNum > 0
          ? 100
          : 0
        : clampPct(((factNum - prevMonthSalesNum) / prevMonthSalesNum) * 100);
  const activeTerritoryKeys = Number(territoryKeyRows[0]?.n ?? 0n);
  const returnLossSum = decToString(lossRows[0]?.s ?? 0);
  const payment_method_options = paymentRefRows.map((r) => r.ref).filter(Boolean);

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
    agg0
  };
}
