import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { buildSalesTerritoryAliasClause, salesDateExprByType } from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

export async function fetchSalesSnapshotOrdersBlock(ctx: SalesSnapshotQueryCtx) {
  const { filters, salesScope, allScope, productFilter } = ctx;
  const [ordersStatusRows, refusalRows, sales_dynamics, akbRows] = await Promise.all([
    prisma.$queryRaw<Array<{ status: string; cnt: bigint }>>`
      SELECT o.status, COUNT(*)::bigint AS cnt
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${allScope}
      GROUP BY o.status
    `,
    prisma.$queryRaw<Array<{ reason: string; cnt: bigint }>>`
      SELECT
        COALESCE(NULLIF(TRIM(o.request_type_ref), ''), 'Не указано') AS reason,
        COUNT(*)::bigint AS cnt
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${allScope}
        AND o.status = 'cancelled'
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ period: string; sales_sum: Prisma.Decimal; orders_count: bigint }>>`
      SELECT
        DATE_TRUNC('day', ${salesDateExprByType(filters.date_type)})::date::text AS period,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.id)::bigint AS orders_count
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      WHERE ${salesScope}
        ${productFilter}
      GROUP BY 1
      ORDER BY period ASC
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(DISTINCT o.client_id)::bigint AS c
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${salesScope}
    `
  ]);
  const statusMap = new Map<string, number>(ordersStatusRows.map((r) => [r.status, Number(r.cnt)]));
  const accepted =
    (statusMap.get("confirmed") ?? 0) +
    (statusMap.get("picking") ?? 0) +
    (statusMap.get("delivering") ?? 0) +
    (statusMap.get("delivered") ?? 0);
  const rejected = statusMap.get("cancelled") ?? 0;
  const pending = statusMap.get("new") ?? 0;
  const total = ordersStatusRows.reduce((s, r) => s + Number(r.cnt), 0);
  const orders_refusals = {
    accepted,
    rejected,
    pending,
    total,
    conversion_pct: total > 0 ? clampPct((accepted / total) * 100) : 0
  };

  const refusalTotal = refusalRows.reduce((s, r) => s + Number(r.cnt), 0);
  const refusal_reason_analytics = refusalRows.map((r) => ({
    reason: r.reason,
    count: Number(r.cnt),
    share_pct: refusalTotal > 0 ? clampPct((Number(r.cnt) / refusalTotal) * 100) : 0
  }));
  return {
    orders_refusals,
    refusal_reason_analytics,
    sales_dynamics: sales_dynamics.map((r) => ({
      period: r.period,
      sales_sum: r.sales_sum.toString(),
      orders_count: Number(r.orders_count)
    })),
    akb: Number(akbRows[0]?.c ?? 0n)
  };
}
