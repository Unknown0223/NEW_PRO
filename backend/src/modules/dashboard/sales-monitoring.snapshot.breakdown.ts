import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import type { SalesMonitoringSnapshot } from "./sales-monitoring.types";
import type { SalesMonitoringBuildBase } from "./sales-monitoring.snapshot.base";

import type { SalesMonitoringBreakdownBlock } from "./sales-monitoring.snapshot.rest";

export async function buildSalesMonitoringBreakdown(
  base: SalesMonitoringBuildBase
): Promise<SalesMonitoringBreakdownBlock> {
  const { salesScope, allClientScope, filters } = base;
  const [categoryRows, groupRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{ category: string; sales_sum: Prisma.Decimal; orders_count: bigint; line_qty: Prisma.Decimal }>
    >`
      SELECT
        COALESCE(pc.name, '—') AS category,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.id)::bigint AS orders_count,
        COALESCE(SUM(oi.qty), 0)::numeric(18,3) AS line_qty
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE ${salesScope}
      GROUP BY 1
      ORDER BY sales_sum DESC
    `,
    prisma.$queryRaw<Array<{ product_group: string; sales_sum: Prisma.Decimal }>>`
      SELECT
        COALESCE(NULLIF(TRIM(pg.name), ''), 'Без группы') AS product_group,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_catalog_groups pg ON pg.id = p.product_group_id
      WHERE ${salesScope}
      GROUP BY 1
      ORDER BY sales_sum DESC
    `
  ]);
  const catGrand = categoryRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));
  const category_sales = categoryRows.map((r) => ({
    category: r.category,
    sales_sum: decToString(r.sales_sum),
    share_pct: catGrand.gt(0) ? clampPct(r.sales_sum.div(catGrand).mul(100).toNumber()) : 0,
    orders_count: Number(r.orders_count ?? 0n),
    line_qty: decToString(r.line_qty)
  }));
  // Fallback: agar mapping hali to'liq yuritilmagan bo'lsa ham guruh chart bo'sh qolmasin.
  const groupRowsEffective =
    groupRows.length > 0
      ? groupRows
      : [
          {
            product_group: "Без классификации",
            sales_sum: categoryRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0))
          }
        ];
  const groupGrand = groupRowsEffective.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));
  const product_group_sales = groupRowsEffective.map((r) => ({
    product_group: r.product_group,
    sales_sum: decToString(r.sales_sum),
    share_pct: groupGrand.gt(0) ? clampPct(r.sales_sum.div(groupGrand).mul(100).toNumber()) : 0
  }));

  const [branchPerfRows, branchOkbRows] = await Promise.all([
    prisma.$queryRaw<Array<{ branch: string; akb: bigint; fact_sales: Prisma.Decimal }>>`
      WITH sales AS (
        SELECT
          COALESCE(NULLIF(TRIM(u.branch), ''), '—') AS branch,
          COUNT(DISTINCT o.client_id)::bigint AS akb,
          COALESCE(SUM(oi.total), 0)::numeric(15,2) AS fact_sales
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        JOIN order_items oi ON oi.order_id = o.id
        WHERE ${salesScope}
        GROUP BY 1
      )
      SELECT * FROM sales ORDER BY fact_sales DESC
    `,
    prisma.$queryRaw<Array<{ branch: string; okb: bigint }>>`
      SELECT
        COALESCE(NULLIF(TRIM(u.branch), ''), '—') AS branch,
        COUNT(DISTINCT caa.client_id)::bigint AS okb
      FROM client_agent_assignments caa
      JOIN users u ON u.id = caa.agent_id
      JOIN clients c ON c.id = caa.client_id
      WHERE ${allClientScope}
      GROUP BY 1
    `
  ]);
  const okbByBranch = new Map(branchOkbRows.map((r) => [r.branch, Number(r.okb ?? 0n)]));
  const branchSorted = [...branchPerfRows].sort((a, b) => {
    const cmp = b.fact_sales.comparedTo(a.fact_sales);
    if (cmp !== 0) return cmp;
    return a.branch.localeCompare(b.branch, "ru");
  });
  const branch_performance = branchSorted.map((r, idx) => {
    const akbN = Number(r.akb);
    const okbN = okbByBranch.get(r.branch) ?? 0;
    const cov = okbN > 0 ? clampPct((akbN / okbN) * 100) : 0;
    return {
      branch: r.branch,
      akb: akbN,
      okb: okbN,
      coverage_pct: cov,
      plan_sales: "0",
      fact_sales: decToString(r.fact_sales),
      execution_pct: null as number | null,
      rank: idx + 1
    };
  });

  const [supRows, tdRows, dailyRows, chRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        supervisor_id: number | null;
        supervisor_name: string | null;
        akb: bigint;
        orders_count: bigint;
        fact_sales: Prisma.Decimal;
      }>
    >`
      SELECT
        u.supervisor_user_id AS supervisor_id,
        COALESCE(NULLIF(TRIM(sup.name), ''), '—') AS supervisor_name,
        COUNT(DISTINCT o.client_id)::bigint AS akb,
        COUNT(DISTINCT o.id)::bigint AS orders_count,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS fact_sales
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      LEFT JOIN users sup ON sup.id = u.supervisor_user_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${salesScope}
      GROUP BY u.supervisor_user_id, sup.name
      ORDER BY fact_sales DESC
    `,
    prisma.$queryRaw<Array<{ direction: string; sales_sum: Prisma.Decimal }>>`
      SELECT
        COALESCE(NULLIF(TRIM(u.trade_direction), ''), '—') AS direction,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${salesScope}
      GROUP BY 1
      ORDER BY sales_sum DESC
    `,
    prisma.$queryRaw<Array<{ day: string; sales_sum: Prisma.Decimal; orders_count: bigint }>>`
      SELECT
        (o.created_at AT TIME ZONE 'UTC')::date::text AS day,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.id)::bigint AS orders_count
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${salesScope}
      GROUP BY 1
      ORDER BY day ASC
    `,
    prisma.$queryRaw<
      Array<{
        channel: string;
        sales_sum: Prisma.Decimal;
        orders_count: bigint;
        active_clients: bigint;
      }>
    >`
      SELECT
        COALESCE(NULLIF(TRIM(c.sales_channel), ''), '—') AS channel,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.id)::bigint AS orders_count,
        COUNT(DISTINCT o.client_id)::bigint AS active_clients
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      WHERE ${salesScope}
      GROUP BY 1
      ORDER BY sales_sum DESC
    `
  ]);
  const planZero = new Prisma.Decimal(0);
  const supervisor_performance = supRows.map((r, idx) => {
    const fact = new Prisma.Decimal(r.fact_sales.toString());
    const gap = planZero.sub(fact);
    return {
      supervisor_id: r.supervisor_id,
      supervisor_name: (r.supervisor_name ?? "—").trim() || "—",
      akb: Number(r.akb),
      orders_count: Number(r.orders_count ?? 0n),
      plan_sales: "0",
      fact_sales: decToString(r.fact_sales),
      execution_pct: null as number | null,
      plan_fact_gap: decToString(gap),
      rank: idx + 1
    };
  });

  const tdGrand = tdRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));
  const trade_directions = tdRows.map((r) => ({
    direction: r.direction,
    sales_sum: decToString(r.sales_sum),
    share_pct: tdGrand.gt(0) ? clampPct(r.sales_sum.div(tdGrand).mul(100).toNumber()) : 0
  }));

  const daily_sales = dailyRows.map((r) => ({
    day: r.day,
    sales_sum: decToString(r.sales_sum),
    orders_count: Number(r.orders_count)
  }));
  const chGrand = chRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));
  const sales_channels = chRows.map((r) => {
    const ordN = Number(r.orders_count ?? 0n);
    const sumN = Number(decToString(r.sales_sum));
    const avgCheck = ordN > 0 ? decToString(Math.round((sumN / ordN + Number.EPSILON) * 100) / 100) : "0";
    return {
      channel: r.channel,
      sales_sum: decToString(r.sales_sum),
      share_pct: chGrand.gt(0) ? clampPct(r.sales_sum.div(chGrand).mul(100).toNumber()) : 0,
      orders_count: ordN,
      active_clients: Number(r.active_clients ?? 0n),
      avg_check: avgCheck
    };
  });
  return {
    category_sales,
    product_group_sales,
    branch_performance,
    supervisor_performance,
    trade_directions,
    daily_sales,
    sales_channels
  };
}
