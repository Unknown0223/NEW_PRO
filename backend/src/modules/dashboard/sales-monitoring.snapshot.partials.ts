import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";
import { buildSalesMonitoringBase } from "./sales-monitoring.snapshot.base";
import { buildSalesMonitoringBreakdown } from "./sales-monitoring.snapshot.breakdown";

export type SalesMonitoringSummaryPayload = {
  filters: SalesMonitoringFilters;
  period: { from: string; to: string };
  plan_fact: {
    plan_sales: string;
    fact_sales: string;
    execution_pct: number | null;
    plan_note: string;
  };
  summary: {
    orders_count: number;
    delivered_orders_count: number;
    order_success_pct: number | null;
    aov: string;
    active_territory_keys: number;
    growth_vs_prev_month_sales_pct: number | null;
    growth_vs_prev_year_sales_pct: number | null;
    forecast_month_end_sales: string | null;
    return_loss_sum: string;
  };
  akb_okb: { akb: number; okb: number; coverage_pct: number };
  year_comparison: {
    current: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    previous: { year: number; month: number; akb: number; orders_count: number; sales_sum: string };
    growth_pct: { akb: number | null; orders_count: number | null; sales_sum: number | null };
  };
  meta: { branch_options: string[]; payment_method_options: string[] };
};

export type SalesMonitoringChartsPayload = {
  filters: SalesMonitoringFilters;
  period: { from: string; to: string };
  category_sales: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["category_sales"];
  product_group_sales: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["product_group_sales"];
  trade_directions: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["trade_directions"];
  daily_sales: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["daily_sales"];
  sales_channels: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["sales_channels"];
};

export type SalesMonitoringTablesPayload = {
  filters: SalesMonitoringFilters;
  period: { from: string; to: string };
  branch_performance: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["branch_performance"];
  supervisor_performance: Awaited<ReturnType<typeof buildSalesMonitoringBreakdown>>["supervisor_performance"];
  sku_matrix: Array<{
    product_id: number;
    sku: string;
    name: string;
    total_sum: string;
    total_qty: string;
    sum_new: string;
    sum_confirmed: string;
    sum_shipped: string;
    sum_delivered: string;
    sum_cancelled: string;
    sum_returned: string;
    return_pct: number | null;
    cancel_pct: number | null;
  }>;
  sku_total: number;
  client_daily_sales: Array<{ client_id: number; client_name: string; day: string; sales_sum: string }>;
  page: number;
  limit: number;
};

function growthPct(cur: number, prev: number): number | null {
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return clampPct(((cur - prev) / prev) * 100);
}

export async function getSalesMonitoringSummary(
  tenantId: number,
  filters: SalesMonitoringFilters
): Promise<SalesMonitoringSummaryPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:sales-monitoring:summary:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SalesMonitoringSummaryPayload>(snapshotKey);
  if (cached) return cached;

  const base = await buildSalesMonitoringBase(tenantId, filters);
  const prevAggRows = await prisma.$queryRaw<
    Array<{ akb: bigint; orders_count: bigint; sales_sum: Prisma.Decimal }>
  >`
    SELECT
      COUNT(DISTINCT o.client_id)::bigint AS akb,
      COUNT(DISTINCT o.id)::bigint AS orders_count,
      COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
    FROM orders o
    JOIN users u ON u.id = o.agent_id
    JOIN clients c ON c.id = o.client_id
    JOIN order_items oi ON oi.order_id = o.id
    WHERE ${base.prevYearSalesScope}
  `;
  const p0 = prevAggRows[0];
  const curAkb = base.akb;
  const curOrd = base.curOrd;
  const curSales = base.factNum;
  const prevAkb = Number(p0?.akb ?? 0n);
  const prevOrd = Number(p0?.orders_count ?? 0n);
  const prevSales = Number(decToString(p0?.sales_sum ?? 0));

  const result: SalesMonitoringSummaryPayload = {
    filters: base.filters,
    period: { from: base.fromYmd, to: base.toYmd },
    plan_fact: {
      plan_sales: base.planSales,
      fact_sales: base.factSales,
      execution_pct: base.execution_pct,
      plan_note: base.plan_note
    },
    summary: {
      orders_count: curOrd,
      delivered_orders_count: base.deliveredOrd,
      order_success_pct: base.order_success_pct,
      aov: base.aov,
      active_territory_keys: base.activeTerritoryKeys,
      growth_vs_prev_month_sales_pct: base.growth_vs_prev_month_sales_pct,
      growth_vs_prev_year_sales_pct: growthPct(curSales, prevSales),
      forecast_month_end_sales: base.forecast_month_end_sales,
      return_loss_sum: base.returnLossSum
    },
    akb_okb: { akb: base.akb, okb: base.okb, coverage_pct: base.coverage_pct },
    year_comparison: {
      current: {
        year: filters.year,
        month: filters.month,
        akb: curAkb,
        orders_count: curOrd,
        sales_sum: decToString(base.agg0?.s ?? 0)
      },
      previous: {
        year: filters.year - 1,
        month: filters.month,
        akb: prevAkb,
        orders_count: prevOrd,
        sales_sum: decToString(p0?.sales_sum ?? 0)
      },
      growth_pct: {
        akb: growthPct(curAkb, prevAkb),
        orders_count: growthPct(curOrd, prevOrd),
        sales_sum: growthPct(curSales, prevSales)
      }
    },
    meta: { branch_options: base.branch_options, payment_method_options: base.payment_method_options }
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

export async function getSalesMonitoringCharts(
  tenantId: number,
  filters: SalesMonitoringFilters
): Promise<SalesMonitoringChartsPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:sales-monitoring:charts:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SalesMonitoringChartsPayload>(snapshotKey);
  if (cached) return cached;

  const base = await buildSalesMonitoringBase(tenantId, filters);
  const breakdown = await buildSalesMonitoringBreakdown(base);
  const result: SalesMonitoringChartsPayload = {
    filters: base.filters,
    period: { from: base.fromYmd, to: base.toYmd },
    category_sales: breakdown.category_sales,
    product_group_sales: breakdown.product_group_sales,
    trade_directions: breakdown.trade_directions,
    daily_sales: breakdown.daily_sales,
    sales_channels: breakdown.sales_channels
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

export type SalesMonitoringTableKind = "sku_matrix" | "branch" | "supervisor" | "client_daily" | "all";

export async function getSalesMonitoringTables(
  tenantId: number,
  filters: SalesMonitoringFilters,
  opts: { page?: number; limit?: number; table?: SalesMonitoringTableKind } = {}
): Promise<SalesMonitoringTablesPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const table = opts.table ?? "all";
  const snapshotKey = `tenant:${tenantId}:dashboard:sales-monitoring:tables:${stableJsonStringify({ filters, page, limit, table })}`;
  const cached = await getSnapshotCache<SalesMonitoringTablesPayload>(snapshotKey);
  if (cached) return cached;

  const base = await buildSalesMonitoringBase(tenantId, filters);
  const offset = (page - 1) * limit;

  let branch_performance: SalesMonitoringTablesPayload["branch_performance"] = [];
  let supervisor_performance: SalesMonitoringTablesPayload["supervisor_performance"] = [];
  let sku_matrix: SalesMonitoringTablesPayload["sku_matrix"] = [];
  let sku_total = 0;
  let client_daily_sales: SalesMonitoringTablesPayload["client_daily_sales"] = [];

  const needsBreakdown = table === "all" || table === "branch" || table === "supervisor";
  const breakdown = needsBreakdown ? await buildSalesMonitoringBreakdown(base) : null;

  if (breakdown) {
    if (table === "all") {
      branch_performance = breakdown.branch_performance;
      supervisor_performance = breakdown.supervisor_performance;
    } else if (table === "branch") {
      const all = breakdown.branch_performance;
      branch_performance = all.slice(offset, offset + limit);
      sku_total = all.length;
    } else if (table === "supervisor") {
      const all = breakdown.supervisor_performance;
      supervisor_performance = all.slice(offset, offset + limit);
      sku_total = all.length;
    }
  }

  if (table === "all" || table === "sku_matrix") {
    const [skuCountRows, skuRows] = await Promise.all([
      prisma.$queryRaw<Array<{ n: bigint }>>`
        SELECT COUNT(*)::bigint AS n FROM (
          SELECT p.id
          FROM orders o
          JOIN users u ON u.id = o.agent_id
          JOIN clients c ON c.id = o.client_id
          JOIN order_items oi ON oi.order_id = o.id
          JOIN products p ON p.id = oi.product_id
          WHERE ${base.skuScope}
          GROUP BY p.id
          HAVING COALESCE(SUM(oi.total), 0) > 0
        ) t
      `,
      prisma.$queryRaw<
        Array<{
          product_id: number;
          sku: string | null;
          name: string;
          total_sum: Prisma.Decimal;
          qty_total: Prisma.Decimal;
          sum_new: Prisma.Decimal;
          sum_confirmed: Prisma.Decimal;
          sum_picking: Prisma.Decimal;
          sum_delivering: Prisma.Decimal;
          sum_delivered: Prisma.Decimal;
          sum_cancelled: Prisma.Decimal;
          sum_returned: Prisma.Decimal;
        }>
      >`
        SELECT
          p.id AS product_id,
          COALESCE(NULLIF(TRIM(p.sku), ''), '') AS sku,
          p.name AS name,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS total_sum,
          COALESCE(SUM(oi.qty), 0)::numeric(18,3) AS qty_total,
          COALESCE(SUM(CASE WHEN o.status = 'new' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_new,
          COALESCE(SUM(CASE WHEN o.status = 'confirmed' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_confirmed,
          COALESCE(SUM(CASE WHEN o.status = 'picking' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_picking,
          COALESCE(SUM(CASE WHEN o.status = 'delivering' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_delivering,
          COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_delivered,
          COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_cancelled,
          COALESCE(SUM(CASE WHEN o.status = 'returned' THEN oi.total ELSE 0 END), 0)::numeric(15,2) AS sum_returned
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        WHERE ${base.skuScope}
        GROUP BY p.id, p.sku, p.name
        HAVING COALESCE(SUM(oi.total), 0) > 0
        ORDER BY total_sum DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    ]);
    sku_total = Number(skuCountRows[0]?.n ?? 0n);
    sku_matrix = skuRows.map((r) => {
      const t = Number(decToString(r.total_sum));
      const ret = Number(decToString(r.sum_returned));
      const can = Number(decToString(r.sum_cancelled));
      return {
        product_id: r.product_id,
        sku: (r.sku ?? "").trim() || String(r.product_id),
        name: r.name,
        total_sum: decToString(r.total_sum),
        total_qty: decToString(r.qty_total),
        sum_new: decToString(r.sum_new),
        sum_confirmed: decToString(r.sum_confirmed),
        sum_shipped: decToString(
          new Prisma.Decimal(r.sum_picking.toString()).plus(new Prisma.Decimal(r.sum_delivering.toString()))
        ),
        sum_delivered: decToString(r.sum_delivered),
        sum_cancelled: decToString(r.sum_cancelled),
        sum_returned: decToString(r.sum_returned),
        return_pct: t > 0 ? clampPct((ret / t) * 100) : null,
        cancel_pct: t > 0 ? clampPct((can / t) * 100) : null
      };
    });
  }

  if (table === "all" || table === "client_daily") {
    const clientDayRows = await prisma.$queryRaw<
      Array<{ client_id: number; client_name: string; day: string; sales_sum: Prisma.Decimal }>
    >`
      SELECT
        c.id AS client_id,
        COALESCE(NULLIF(TRIM(c.name), ''), '—') AS client_name,
        (o.created_at AT TIME ZONE 'UTC')::date::text AS day,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${base.salesScope}
      GROUP BY c.id, c.name, (o.created_at AT TIME ZONE 'UTC')::date
      HAVING COALESCE(SUM(oi.total), 0) <> 0
      ORDER BY sales_sum DESC
      LIMIT 2500
    `;
    client_daily_sales = clientDayRows.map((r) => ({
      client_id: r.client_id,
      client_name: r.client_name,
      day: r.day,
      sales_sum: decToString(r.sales_sum)
    }));
  }

  const result: SalesMonitoringTablesPayload = {
    filters: base.filters,
    period: { from: base.fromYmd, to: base.toYmd },
    branch_performance,
    supervisor_performance,
    sku_matrix,
    sku_total,
    client_daily_sales,
    page,
    limit
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
