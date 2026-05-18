import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { buildSalesTerritoryAliasClause, salesDateExprByType } from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

export async function fetchSalesSnapshotProductBlock(ctx: SalesSnapshotQueryCtx) {
  const { salesScope, productFilter } = ctx;
  const [totalRow, paymentRows] = await Promise.all([
    prisma.$queryRaw<Array<{ sales_sum: Prisma.Decimal; orders_count: bigint }>>`
      SELECT
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.id)::bigint AS orders_count
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${salesScope}
        ${productFilter}
    `,
    prisma.$queryRaw<Array<{ payment_type: string; sales_sum: Prisma.Decimal }>>`
      SELECT
        COALESCE(NULLIF(TRIM(o.payment_method_ref), ''), '—') AS payment_type,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1
      ORDER BY sales_sum DESC
    `
  ]);
  const totalSales = totalRow[0]?.sales_sum ?? new Prisma.Decimal(0);

  const payment_method_analytics = paymentRows.map((r) => ({
    payment_type: r.payment_type,
    sales_sum: r.sales_sum.toString(),
    share_pct: totalSales.gt(0) ? clampPct(r.sales_sum.div(totalSales).mul(100).toNumber()) : 0
  }));

  const [categoryRows, groupRows, perfRows] = await Promise.all([
    prisma.$queryRaw<Array<{ category: string; sales_sum: Prisma.Decimal }>>`
      SELECT
        COALESCE(pc.name, 'Неизвестный') AS category,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1
      ORDER BY sales_sum DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ product_group: string; sales_sum: Prisma.Decimal }>>`
      SELECT
        COALESCE(pg.name, 'Неизвестный') AS product_group,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_catalog_groups pg ON pg.id = p.product_group_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1
      ORDER BY sales_sum DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{
      category: string;
      sales_sum: Prisma.Decimal;
      sold_qty: Prisma.Decimal;
      volume: Prisma.Decimal;
      akb: bigint;
    }>>`
      SELECT
        COALESCE(pc.name, 'Неизвестный') AS category,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS sold_qty,
        COALESCE(SUM(oi.qty), 0)::numeric(15,3) AS volume,
        COUNT(DISTINCT o.client_id)::bigint AS akb
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1
      ORDER BY sales_sum DESC
      LIMIT 100
    `
  ]);

  const categoryGrand = categoryRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));
  const groupGrand = groupRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));
  const perfGrand = perfRows.reduce((acc, r) => acc.add(r.sales_sum), new Prisma.Decimal(0));

  const product_category_analytics = categoryRows.map((r) => ({
    category: r.category,
    sales_sum: r.sales_sum.toString(),
    share_pct: categoryGrand.gt(0) ? clampPct(r.sales_sum.div(categoryGrand).mul(100).toNumber()) : 0
  }));
  const product_group_analytics = groupRows.map((r) => ({
    product_group: r.product_group,
    sales_sum: r.sales_sum.toString(),
    share_pct: groupGrand.gt(0) ? clampPct(r.sales_sum.div(groupGrand).mul(100).toNumber()) : 0
  }));
  const category_performance_table = perfRows.map((r) => ({
    category: r.category,
    sales_sum: r.sales_sum.toString(),
    sold_qty: r.sold_qty.toString(),
    volume: r.volume.toString(),
    akb: Number(r.akb),
    share_pct: perfGrand.gt(0) ? clampPct(r.sales_sum.div(perfGrand).mul(100).toNumber()) : 0
  }));
  return {
    total_sales_summary: {
      total_sales_sum: totalSales.toString(),
      orders_count: Number(totalRow[0]?.orders_count ?? 0n)
    },
    payment_method_analytics,
    product_category_analytics,
    product_group_analytics,
    category_performance_table
  };
}
