import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";

export async function getClientChurn(
  tenantId: number,
  monthsAgo = 3
): Promise<{
  churnedClients: Array<{ client_id: number; client_name: string; last_order: string; total_historical: string }>;
  totalClients: number;
  activeClients: number;
  churnRate: number;
}> {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - monthsAgo * 30 * 86400000);
  const lookbackDate = new Date(now.getTime() - 365 * 86400000);

  // Active clients (ordered in last N months)
  const activeClients = await prisma.$queryRaw<
    Array<{ client_id: number }>
  >`
    SELECT DISTINCT o.client_id
    FROM orders o
    JOIN clients c ON c.id = o.client_id
    WHERE o.tenant_id = ${tenantId}
      AND o.status NOT IN ('cancelled', 'returned')
      AND o.created_at >= ${thresholdDate}
      AND c.merged_into_client_id IS NULL
  `;

  const activeIds = new Set(activeClients.map((c) => c.client_id));

  // All clients who ever ordered
  const allClients = await prisma.$queryRaw<
    Array<{ id: number; name: string }>
  >`
    SELECT c.id, c.name
    FROM clients c
    WHERE c.tenant_id = ${tenantId}
      AND c.merged_into_client_id IS NULL
      AND EXISTS (
        SELECT 1 FROM orders o WHERE o.client_id = c.id AND o.tenant_id = ${tenantId}
          AND o.created_at >= ${lookbackDate} AND o.status NOT IN ('cancelled', 'returned')
      )
  `;

  const allCount = allClients.length;
  const activeCount = activeIds.size;
  const totalChurned = allCount - activeCount;
  const churnRate = allCount > 0 ? Number((totalChurned / allCount * 100).toFixed(1)) : 0;

  const churnedCandidateIds = allClients.filter((c) => !activeIds.has(c.id)).map((c) => c.id);

  const churnedRows =
    churnedCandidateIds.length === 0
      ? []
      : await prisma.$queryRaw<
          Array<{
            client_id: number;
            client_name: string;
            last_order: Date;
            total_historical: Prisma.Decimal;
          }>
        >`
    SELECT c.id AS client_id, c.name AS client_name,
      MAX(o.created_at) AS last_order,
      COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS total_historical
    FROM clients c
    JOIN orders o ON o.client_id = c.id AND o.status NOT IN ('cancelled', 'returned')
    WHERE c.tenant_id = ${tenantId}
      AND c.merged_into_client_id IS NULL
      AND c.id IN (${Prisma.join(churnedCandidateIds.map((id) => Prisma.sql`${id}`))})
    GROUP BY c.id, c.name
    ORDER BY last_order DESC
    LIMIT 50
  `;

  return {
    churnedClients: churnedRows.map((r) => ({
      client_id: r.client_id,
      client_name: r.client_name,
      last_order: r.last_order.toISOString(),
      total_historical: String(r.total_historical)
    })),
    totalClients: allCount,
    activeClients: activeCount,
    churnRate
  };
}
