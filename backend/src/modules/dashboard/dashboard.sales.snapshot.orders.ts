import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { buildSalesTerritoryAliasClause, salesDateExprByType } from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

export async function fetchSalesSnapshotOrdersBlock(ctx: SalesSnapshotQueryCtx) {
  const { tenantId, filters, salesScope, allScope, productFilter, territoryTerms } = ctx;
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T23:59:59.999Z`);
  const [ordersStatusRows, refusalRows, sales_dynamics, akbRows, returnsRows] = await Promise.all([
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
    `,
    prisma.$queryRaw<Array<{ period: string; returns_sum: Prisma.Decimal }>>`
      SELECT
        DATE_TRUNC('day', sr.created_at)::date::text AS period,
        COALESCE(SUM(sr.refund_amount), 0)::numeric(15,2) AS returns_sum
      FROM sales_returns sr
      LEFT JOIN orders o ON o.id = sr.order_id
      LEFT JOIN orders mo ON mo.id = sr.mirror_order_id
      JOIN clients c ON c.id = COALESCE(sr.client_id, o.client_id)
      LEFT JOIN users u ON u.id = COALESCE(o.agent_id, mo.agent_id)
      WHERE sr.tenant_id = ${tenantId}
        AND sr.status = 'posted'
        AND sr.created_at >= ${from}
        AND sr.created_at <= ${to}
        ${filters.agent_ids.length > 0 ? Prisma.sql`AND u.id IN (${Prisma.join(filters.agent_ids)})` : Prisma.empty}
        ${filters.supervisor_ids.length > 0 ? Prisma.sql`AND u.supervisor_user_id IN (${Prisma.join(filters.supervisor_ids)})` : Prisma.empty}
        ${filters.trade_directions.length > 0 ? Prisma.sql`AND COALESCE(u.trade_direction, '') IN (${Prisma.join(filters.trade_directions)})` : Prisma.empty}
        ${buildSalesTerritoryAliasClause("c", territoryTerms)}
      GROUP BY 1
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
  const byDay = new Map<string, { period: string; sales_sum: string; orders_count: number; returns_sum: string }>();
  for (const r of sales_dynamics) {
    byDay.set(r.period, {
      period: r.period,
      sales_sum: r.sales_sum.toString(),
      orders_count: Number(r.orders_count),
      returns_sum: "0"
    });
  }
  for (const r of returnsRows) {
    const row = byDay.get(r.period) ?? { period: r.period, sales_sum: "0", orders_count: 0, returns_sum: "0" };
    row.returns_sum = r.returns_sum.toString();
    byDay.set(r.period, row);
  }
  return {
    orders_refusals,
    refusal_reason_analytics,
    sales_dynamics: [...byDay.values()].sort((a, b) => a.period.localeCompare(b.period)),
    akb: Number(akbRows[0]?.c ?? 0n)
  };
}
