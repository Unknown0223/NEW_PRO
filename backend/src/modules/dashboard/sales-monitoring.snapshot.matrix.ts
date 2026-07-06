import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import type { SalesMonitoringSnapshot } from "./sales-monitoring.types";
import type { SalesMonitoringBuildBase } from "./sales-monitoring.snapshot.base";

import type { SalesMonitoringBreakdownBlock } from "./sales-monitoring.snapshot.rest";

export async function assembleSalesMonitoringSnapshot(
  base: SalesMonitoringBuildBase,
  breakdown: SalesMonitoringBreakdownBlock
): Promise<SalesMonitoringSnapshot> {
  const {
    filters,
    fromYmd,
    toYmd,
    salesScope,
    skuScope,
    prevYearSalesScope,
    factSales,
    curOrd,
    deliveredOrd,
    planSales,
    execution_pct,
    plan_note,
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
    factNum
  } = base;
  const {
    category_sales,
    product_group_sales,
    branch_performance,
    supervisor_performance,
    trade_directions,
    daily_sales,
    sales_channels
  } = breakdown;
  const [skuRows, clientDayRows, prevAggRows] = await Promise.all([
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
      WHERE ${skuScope}
      GROUP BY p.id, p.sku, p.name
      HAVING COALESCE(SUM(oi.total), 0) > 0
      ORDER BY total_sum DESC
      LIMIT 500
    `,
    prisma.$queryRaw<
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
      WHERE ${salesScope}
      GROUP BY c.id, c.name, (o.created_at AT TIME ZONE 'UTC')::date
      HAVING COALESCE(SUM(oi.total), 0) <> 0
      ORDER BY sales_sum DESC
      LIMIT 2500
    `,
    prisma.$queryRaw<Array<{ akb: bigint; orders_count: bigint; sales_sum: Prisma.Decimal }>>`
      SELECT
        COUNT(DISTINCT o.client_id)::bigint AS akb,
        COUNT(DISTINCT o.id)::bigint AS orders_count,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${prevYearSalesScope}
    `
  ]);
  const sku_matrix = skuRows.map((r) => {
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

  const client_daily_sales = clientDayRows.map((r) => ({
    client_id: r.client_id,
    client_name: r.client_name,
    day: r.day,
    sales_sum: decToString(r.sales_sum)
  }));

  const prevYear = filters.year - 1;
  const prevMonth = filters.month;
  const p0 = prevAggRows[0];
  const curAkb = akb;
  const curSales = factNum;
  const prevAkb = Number(p0?.akb ?? 0n);
  const prevOrd = Number(p0?.orders_count ?? 0n);
  const prevSales = Number(decToString(p0?.sales_sum ?? 0));
  const growth = (cur: number, prev: number): number | null => {
    if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
    if (prev === 0) return cur > 0 ? 100 : 0;
    return clampPct(((cur - prev) / prev) * 100);
  };

  const growth_vs_prev_year_sales_pct = growth(curSales, prevSales);

  const summary = {
    orders_count: curOrd,
    delivered_orders_count: deliveredOrd,
    order_success_pct,
    aov,
    active_territory_keys: activeTerritoryKeys,
    growth_vs_prev_month_sales_pct,
    growth_vs_prev_year_sales_pct,
    forecast_month_end_sales,
    return_loss_sum: returnLossSum
  };

  const result: SalesMonitoringSnapshot = {
    filters,
    period: { from: fromYmd, to: toYmd },
    plan_fact: {
      plan_sales: planSales,
      fact_sales: factSales,
      execution_pct,
      plan_note
    },
    summary,
    akb_okb: { akb, okb, coverage_pct },
    category_sales,
    product_group_sales,
    branch_performance,
    supervisor_performance,
    trade_directions,
    daily_sales,
    sales_channels,
    portfolio_akb: { akb, okb, coverage_pct },
    sku_matrix,
    client_daily_sales,
    year_comparison: {
      current: {
        year: filters.year,
        month: filters.month,
        akb: curAkb,
        orders_count: curOrd,
        sales_sum: decToString(agg0?.s ?? 0)
      },
      previous: {
        year: prevYear,
        month: prevMonth,
        akb: prevAkb,
        orders_count: prevOrd,
        sales_sum: decToString(p0?.sales_sum ?? 0)
      },
      growth_pct: {
        akb: growth(curAkb, prevAkb),
        orders_count: growth(curOrd, prevOrd),
        sales_sum: growth(curSales, prevSales)
      }
    },
    meta: { branch_options, payment_method_options }
  };
  return result;
}
