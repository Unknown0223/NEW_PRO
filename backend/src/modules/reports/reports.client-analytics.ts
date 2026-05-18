import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";

/** ─── 4. Client Analytics ───────────────────────────────── */

export async function getClientAnalytics(
  tenantId: number,
  from?: string,
  to?: string,
  limit = 20
): Promise<{
  data: Array<{
    client_id: number;
    client_name: string;
    order_count: number;
    total_spent: string;
    last_order_date: string | null;
    balance: string;
  }>;
}> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 30 * 86400000);
  const end = range.lte ?? new Date();

  const rows = await prisma.$queryRaw<
    Array<{
      client_id: number;
      client_name: string;
      order_count: bigint;
      total_spent: Prisma.Decimal;
      last_order_date: Date | null;
    }>
  >`
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      COUNT(DISTINCT o.id)::bigint AS order_count,
      COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS total_spent,
      MAX(o.created_at) AS last_order_date
    FROM clients c
    LEFT JOIN orders o ON o.client_id = c.id
      AND o.created_at >= ${start}
      AND o.created_at <= ${end}
      AND o.tenant_id = ${tenantId}
    WHERE c.tenant_id = ${tenantId}
      AND c.merged_into_client_id IS NULL
    GROUP BY c.id, c.name
    HAVING COUNT(DISTINCT o.id) > 0
    ORDER BY total_spent DESC
    LIMIT ${limit}
  `;

  const clientIds = rows.map((r) => r.client_id);
  const balances = clientIds.length > 0
    ? await prisma.clientBalance.findMany({
        where: { tenant_id: tenantId, client_id: { in: clientIds } },
        select: { client_id: true, balance: true }
      })
    : [];
  const balMap = new Map<number, string>(balances.map((b) => [b.client_id, b.balance.toString()]));

  return {
    data: rows.map((r) => ({
      client_id: r.client_id,
      client_name: r.client_name,
      order_count: Number(r.order_count),
      total_spent: String(r.total_spent),
      last_order_date: r.last_order_date?.toISOString() ?? null,
      balance: balMap.get(r.client_id) ?? "0"
    }))
  };
}

/** ─── 5. Agent KPI ──────────────────────────────────────── */
