import { Prisma } from "@prisma/client";

/**
 * Zakazda agent yo‘q bo‘lsa: avval manba zakaz (vazvrat), keyin klientning agenti.
 * `clients c` shu so‘rovda bog‘langan bo‘lishi kerak.
 */
export const resolvedAgentIdSql = Prisma.sql`COALESCE(o.agent_id, (
  SELECT so.agent_id
  FROM sales_returns sr
  JOIN orders so ON so.id = sr.order_id AND so.tenant_id = sr.tenant_id
  WHERE sr.tenant_id = o.tenant_id
    AND sr.mirror_order_id = o.id
    AND so.agent_id IS NOT NULL
  ORDER BY sr.id DESC
  LIMIT 1
), c.agent_id)`;

export function orderBucketsByAmount<T extends { buckets: string[]; rows: Array<{ values: Record<string, { amount: string }> }> }>(matrix: T): T {
  const totals = new Map<string, number>();
  for (const row of matrix.rows) {
    for (const [bucket, value] of Object.entries(row.values)) {
      totals.set(bucket, (totals.get(bucket) ?? 0) + Number(value.amount));
    }
  }
  return {
    ...matrix,
    buckets: [...matrix.buckets].sort((a, b) => (totals.get(b) ?? 0) - (totals.get(a) ?? 0) || a.localeCompare(b, "ru"))
  };
}
