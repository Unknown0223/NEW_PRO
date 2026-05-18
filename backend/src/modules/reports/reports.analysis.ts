import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";

export async function getStatusDistribution(tenantId: number): Promise<{ status: string; count: number }[]> {
  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: { tenant_id: tenantId },
    _count: { id: true }
  });
  return rows.map((r) => ({ status: r.status, count: r._count.id }));
}

/** ─── 7. Channel Stats ──────────────────────────────────── */

export async function getChannelStats(
  tenantId: number,
  from?: string,
  to?: string
): Promise<{
  channels: Array<{ channel: string | null; order_count: number; total_sum: string }>;
  tradeDirections: Array<{ direction: string | null; order_count: number; total_sum: string }>;
}> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 30 * 86400000);
  const end = range.lte ?? new Date();

  // Raw SQL: join clients va users bilan bir query — N+1 oldini olish
  const [channelRows, dirRows] = await Promise.all([
    prisma.$queryRaw<Array<{ channel: string | null; order_count: bigint; total_sum: Prisma.Decimal }>>`
      SELECT c.sales_channel AS channel, COUNT(o.id)::bigint AS order_count, COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS total_sum
      FROM orders o JOIN clients c ON c.id = o.client_id
      WHERE o.tenant_id = ${tenantId} AND o.created_at >= ${start} AND o.created_at <= ${end}
      GROUP BY c.sales_channel ORDER BY total_sum DESC
    `,
    prisma.$queryRaw<Array<{ trade_direction: string | null; order_count: bigint; total_sum: Prisma.Decimal }>>`
      SELECT u.trade_direction, COUNT(o.id)::bigint AS order_count, COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS total_sum
      FROM orders o LEFT JOIN users u ON u.id = o.agent_id
      WHERE o.tenant_id = ${tenantId} AND o.created_at >= ${start} AND o.created_at <= ${end}
      GROUP BY u.trade_direction ORDER BY total_sum DESC
    `
  ]);

  return {
    channels: channelRows.map((r) => ({
      channel: String(r.channel),
      order_count: Number(r.order_count),
      total_sum: String(r.total_sum)
    })),
    tradeDirections: dirRows.map((r) => ({
      direction: String(r.trade_direction),
      order_count: Number(r.order_count),
      total_sum: String(r.total_sum)
    }))
  };
}
/** ─── 8. ABC Client Analysis ────────────────────────────── */

export async function getAbcAnalysis(
  tenantId: number,
  from?: string,
  to?: string
): Promise<{
  categoryA: Array<{ client_id: number; client_name: string; total: string; pct: number }>;
  categoryB: Array<{ client_id: number; client_name: string; total: string; pct: number }>;
  categoryC: Array<{ client_id: number; client_name: string; total: string; pct: number }>;
}> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 90 * 86400000);
  const end = range.lte ?? new Date();

  const rows = await prisma.$queryRaw<
    Array<{ client_id: number; client_name: string; total: Prisma.Decimal }>
  >`
    SELECT c.id AS client_id, c.name AS client_name, COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS total
    FROM clients c
    LEFT JOIN orders o ON o.client_id = c.id AND o.status NOT IN ('cancelled', 'returned')
      AND o.created_at >= ${start} AND o.created_at <= ${end}
    WHERE c.tenant_id = ${tenantId} AND c.merged_into_client_id IS NULL
    GROUP BY c.id, c.name
    HAVING SUM(o.total_sum) > 0
    ORDER BY total DESC
  `;

  const grandTotal = rows.reduce((s, r) => s.plus(r.total), new Prisma.Decimal(0));
  if (grandTotal.equals(0)) return { categoryA: [], categoryB: [], categoryC: [] };

  const clients = rows.map((r) => ({
    client_id: r.client_id,
    client_name: r.client_name,
    total: r.total,
    pct: Number(r.total) / Number(grandTotal) * 100
  }));

  let cumulative = 0;
  const categoryA: typeof clients = [];
  const categoryB: typeof clients = [];
  const categoryC: typeof clients = [];

  for (const c of clients) {
    cumulative += c.pct;
    if (cumulative <= 80) categoryA.push(c);
    else if (cumulative <= 95) categoryB.push(c);
    else categoryC.push(c);
  }

  return {
    categoryA: categoryA.map((x) => ({ ...x, total: x.total.toString() })),
    categoryB: categoryB.map((x) => ({ ...x, total: x.total.toString() })),
    categoryC: categoryC.map((x) => ({ ...x, total: x.total.toString() }))
  };
}

/** ─── 9. XYZ Client Stability ──────────────────────────── */

export async function getXyzAnalysis(
  tenantId: number,
  from?: string,
  to?: string
): Promise<Record<string, Array<{ client_id: number; client_name: string; avg: string; cv: number }>>> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 180 * 86400000);
  const end = range.lte ?? new Date();

  // Group orders by month per client
  const rows = await prisma.$queryRaw<
    Array<{ client_id: number; client_name: string; month: string; monthly_total: Prisma.Decimal }>
  >`
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      DATE_TRUNC('month', o.created_at)::date AS month,
      COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS monthly_total
    FROM clients c
    JOIN orders o ON o.client_id = c.id
    WHERE c.tenant_id = ${tenantId}
      AND o.status NOT IN ('cancelled', 'returned')
      AND o.created_at >= ${start}
      AND o.created_at <= ${end}
    GROUP BY c.id, c.name, DATE_TRUNC('month', o.created_at)
    ORDER BY c.id, month
  `;

  const grouped = new Map<number, { name: string; months: number[] }>();
  for (const r of rows) {
    const key = r.client_id;
    if (!grouped.has(key)) grouped.set(key, { name: String(r.client_name), months: [] });
    grouped.get(key)!.months.push(Number(r.monthly_total));
  }

  const xClients: Array<{ client_id: number; client_name: string; avg: string; cv: number }> = [];
  const yClients: Array<{ client_id: number; client_name: string; avg: string; cv: number }> = [];
  const zClients: Array<{ client_id: number; client_name: string; avg: string; cv: number }> = [];

  for (const [id, data] of grouped) {
    const n = data.months.length;
    if (n < 2) { zClients.push({ client_id: Number(id), client_name: data.name, avg: "0", cv: 0 }); continue; }
    const avg = data.months.reduce((s, v) => s + v, 0) / n;
    const variance = data.months.reduce((s, v) => s + (v - avg) ** 2, 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = avg > 0 ? stdDev / avg : 0;
    const entry = { client_id: Number(id), client_name: data.name, avg: Number(avg).toFixed(2), cv: Math.round(cv * 1000) / 1000 };

    if (cv < 0.1) xClients.push(entry);
    else if (cv < 0.25) yClients.push(entry);
    else zClients.push(entry);
  }

  return { xClients, yClients, zClients };
}

/** ─── 10. Client Churn ─────────────────────────────────── */

