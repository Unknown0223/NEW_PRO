import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";

/** ─── 1. Sales Summary ───────────────────────────────────── */

export type SalesSummaryRow = {
  period: string;
  order_count: number;
  total_sum: string;
  payment_count: number;
  payment_sum: string;
  return_count: number;
  return_amount: string;
  net_revenue: string;
};

export type AgentSale = {
  agent_id: number;
  agent_name: string;
  order_count: number;
  total_sum: string;
};

export async function getSalesSummary(
  tenantId: number,
  from?: string,
  to?: string
): Promise<{ data: SalesSummaryRow[]; agents: AgentSale[] }> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 30 * 86400000);
  const end = range.lte ?? new Date();

  const [orderCount, orderAgg, payCount, payAgg, retCount, retAgg] = await Promise.all([
    prisma.order.count({ where: { tenant_id: tenantId, created_at: { gte: start, lte: end } } }),
    prisma.order.aggregate({ where: { tenant_id: tenantId, created_at: { gte: start, lte: end } }, _sum: { total_sum: true } }),
    prisma.payment.count({
      where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: start, lte: end } }
    }),
    prisma.payment.aggregate({
      where: { tenant_id: tenantId, deleted_at: null, created_at: { gte: start, lte: end } },
      _sum: { amount: true }
    }),
    prisma.salesReturn.count({ where: { tenant_id: tenantId, status: "posted", created_at: { gte: start, lte: end } } }),
    prisma.salesReturn.aggregate({ where: { tenant_id: tenantId, status: "posted", created_at: { gte: start, lte: end } }, _sum: { refund_amount: true } })
  ]);

  // Per-agent
  const agentOrders = await prisma.order.groupBy({
    by: ["agent_id"],
    where: {
      tenant_id: tenantId,
      created_at: { gte: start, lte: end },
      agent_id: { not: null }
    },
    _count: { id: true },
    _sum: { total_sum: true },
    orderBy: [{ _sum: { total_sum: "desc" } }]
  });

  const agentIds = agentOrders.map((a) => a.agent_id).filter((x): x is number => x != null);
  const agents = agentIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: agentIds } },
        select: { id: true, name: true }
      })
    : [];
  const agentMap = new Map<number, string>(agents.map((a) => [a.id, a.name]));

  const orderSum = orderAgg._sum.total_sum ?? new Prisma.Decimal(0);
  const paySum = payAgg._sum.amount ?? new Prisma.Decimal(0);
  const retSum = retAgg._sum.refund_amount ?? new Prisma.Decimal(0);

  return {
    data: [{
      period: "total",
      order_count: orderCount,
      total_sum: orderSum.toString(),
      payment_count: payCount,
      payment_sum: paySum.toString(),
      return_count: retCount,
      return_amount: retSum.toString(),
      net_revenue: new Prisma.Decimal(orderSum).minus(retSum).toString()
    }],
    agents: agentOrders.map((a) => ({
      agent_id: a.agent_id!,
      agent_name: agentMap.get(a.agent_id!) ?? "Unknown",
      order_count: a._count.id,
      total_sum: (a._sum.total_sum ?? new Prisma.Decimal(0)).toString()
    }))
  };
}

/** ─── 2. Order Trends ──────────────────────────────────── */

export async function getOrderTrends(
  tenantId: number,
  from?: string,
  to?: string
): Promise<{ date: string; orders: number; revenue: string }[]> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 30 * 86400000);
  const end = range.lte ?? new Date();

  const rows = await prisma.$queryRaw<Array<{ day: string; cnt: bigint; rev: Prisma.Decimal }>>`
    SELECT
      DATE_TRUNC('day', created_at)::date AS day,
      COUNT(*)::bigint AS cnt,
      COALESCE(SUM(total_sum), 0)::numeric(15,2) AS rev
    FROM orders
    WHERE tenant_id = ${tenantId}
      AND created_at >= ${start}
      AND created_at <= ${end}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((r) => ({
    date: String(r.day),
    orders: Number(r.cnt),
    revenue: String(r.rev)
  }));
}
