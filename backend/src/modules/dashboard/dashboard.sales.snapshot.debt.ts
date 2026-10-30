import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { salesReceivableScopeSql } from "./dashboard.sales.scope";
import type { SalesDashboardSnapshot } from "./dashboard.sales.types";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";

type DebtAgingRow = {
  total: Prisma.Decimal;
  debtors: bigint;
  d0_7: Prisma.Decimal;
  d8_14: Prisma.Decimal;
  d15_21: Prisma.Decimal;
  d22_30: Prisma.Decimal;
  d30_plus: Prisma.Decimal;
};

const BUCKET_KEYS = ["d0_7", "d8_14", "d15_21", "d22_30", "d30_plus"] as const;

/** Qarz yoshi — `delivered` bo‘lgan kundan bugungacha (to‘lov taqsimotidan keyingi qoldiq). */
export async function fetchSalesSnapshotDebtBlock(
  ctx: SalesSnapshotQueryCtx
): Promise<SalesDashboardSnapshot["debt_aging"]> {
  const scope = salesReceivableScopeSql(ctx.tenantId, ctx.filters, ctx.territoryTerms);
  const [row] = await prisma.$queryRaw<DebtAgingRow[]>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS s
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${ctx.tenantId}
      GROUP BY pa.order_id
    ),
    debt AS (
      SELECT
        o.client_id,
        GREATEST(o.total_sum - COALESCE(a.s, 0), 0)::numeric(15,2) AS amt,
        (CURRENT_DATE - COALESCE(
          (SELECT MAX(sl.created_at) FROM order_status_logs sl
            WHERE sl.order_id = o.id AND sl.to_status = 'delivered'),
          o.updated_at
        )::date) AS age_days
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN alloc a ON a.order_id = o.id
      WHERE ${scope}
    )
    SELECT
      COALESCE(SUM(amt), 0)::numeric(15,2) AS total,
      COUNT(DISTINCT client_id)::bigint AS debtors,
      COALESCE(SUM(amt) FILTER (WHERE age_days <= 7), 0)::numeric(15,2) AS d0_7,
      COALESCE(SUM(amt) FILTER (WHERE age_days BETWEEN 8 AND 14), 0)::numeric(15,2) AS d8_14,
      COALESCE(SUM(amt) FILTER (WHERE age_days BETWEEN 15 AND 21), 0)::numeric(15,2) AS d15_21,
      COALESCE(SUM(amt) FILTER (WHERE age_days BETWEEN 22 AND 30), 0)::numeric(15,2) AS d22_30,
      COALESCE(SUM(amt) FILTER (WHERE age_days > 30), 0)::numeric(15,2) AS d30_plus
    FROM debt
    WHERE amt > 0
  `;
  const total = row?.total ?? new Prisma.Decimal(0);
  return {
    total_debt: total.toString(),
    debtors_count: Number(row?.debtors ?? 0n),
    buckets: BUCKET_KEYS.map((key) => {
      const sum = row?.[key] ?? new Prisma.Decimal(0);
      return {
        key,
        sum: sum.toString(),
        share_pct: total.gt(0) ? clampPct(sum.div(total).mul(100).toNumber()) : 0
      };
    })
  };
}
