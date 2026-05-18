import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";

/** ─── Client receivables (ochiq zakazlar / kredit yuki) ─── */

export type ClientReceivableRow = {
  client_id: number;
  name: string;
  phone: string | null;
  is_active: boolean;
  credit_limit: string;
  account_balance: string;
  outstanding: string;
  headroom: string;
  headroom_remaining: string;
  over_limit: boolean;
};

export type ClientReceivablesResult = {
  data: ClientReceivableRow[];
  total: number;
  page: number;
  limit: number;
};

export async function getClientReceivables(
  tenantId: number,
  opts: {
    page: number;
    limit: number;
    search?: string;
    only_over_limit?: boolean;
    active_only?: boolean;
  }
): Promise<ClientReceivablesResult> {
  const page = Math.max(1, Math.floor(opts.page));
  const limit = Math.min(200, Math.max(1, Math.floor(opts.limit)));
  const offset = (page - 1) * limit;

  const q = (opts.search ?? "").trim();
  const searchClause =
    q.length > 0
      ? Prisma.sql`AND (c.name ILIKE ${`%${q}%`} OR COALESCE(c.phone, '') ILIKE ${`%${q}%`})`
      : Prisma.empty;

  const activeClause = opts.active_only === true ? Prisma.sql`AND c.is_active = true` : Prisma.empty;

  /** Limitdan oshgan — `filtered` ichida ustunlar `fr` nomisiz (bir darajali CTE) */
  const overClause =
    opts.only_over_limit === true
      ? Prisma.sql`AND credit_limit > 0 AND outstanding > (credit_limit + account_balance)`
      : Prisma.empty;

  const countRows = await prisma.$queryRaw<[{ total: bigint }]>`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ),
    unpaid AS (
      SELECT o.client_id,
        SUM(GREATEST(o.total_sum - COALESCE(a.sum_amt, 0), 0))::numeric(15,2) AS outstanding
      FROM orders o
      LEFT JOIN alloc a ON a.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
      GROUP BY o.client_id
      HAVING SUM(GREATEST(o.total_sum - COALESCE(a.sum_amt, 0), 0)) > 0
    ),
    fr AS (
      SELECT
        c.id AS client_id,
        c.credit_limit::numeric(15,2) AS credit_limit,
        COALESCE(cb.balance, 0)::numeric(15,2) AS account_balance,
        unpaid.outstanding
      FROM unpaid
      INNER JOIN clients c ON c.id = unpaid.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN client_balances cb ON cb.tenant_id = c.tenant_id AND cb.client_id = c.id
      WHERE c.merged_into_client_id IS NULL
        ${searchClause}
        ${activeClause}
    ),
    filtered AS (
      SELECT * FROM fr WHERE true
        ${overClause}
    )
    SELECT COUNT(*)::bigint AS total FROM filtered
  `;

  const total = Number(countRows[0]?.total ?? 0n);

  const dataRows = await prisma.$queryRaw<
    Array<{
      client_id: number;
      name: string;
      phone: string | null;
      is_active: boolean;
      credit_limit: Prisma.Decimal;
      account_balance: Prisma.Decimal;
      outstanding: Prisma.Decimal;
      headroom: Prisma.Decimal;
      headroom_remaining: Prisma.Decimal;
      over_limit: boolean;
    }>
  >`
    WITH alloc AS (
      SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS sum_amt
      FROM payment_allocations pa
      WHERE pa.tenant_id = ${tenantId}
      GROUP BY pa.order_id
    ),
    unpaid AS (
      SELECT o.client_id,
        SUM(GREATEST(o.total_sum - COALESCE(a.sum_amt, 0), 0))::numeric(15,2) AS outstanding
      FROM orders o
      LEFT JOIN alloc a ON a.order_id = o.id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status IN (${Prisma.join([...ORDER_STATUSES_OUTSTANDING_RECEIVABLE])})
      GROUP BY o.client_id
      HAVING SUM(GREATEST(o.total_sum - COALESCE(a.sum_amt, 0), 0)) > 0
    ),
    fr AS (
      SELECT
        c.id AS client_id,
        c.name,
        c.phone,
        c.is_active,
        c.credit_limit::numeric(15,2) AS credit_limit,
        COALESCE(cb.balance, 0)::numeric(15,2) AS account_balance,
        unpaid.outstanding
      FROM unpaid
      INNER JOIN clients c ON c.id = unpaid.client_id AND c.tenant_id = ${tenantId}
      LEFT JOIN client_balances cb ON cb.tenant_id = c.tenant_id AND cb.client_id = c.id
      WHERE c.merged_into_client_id IS NULL
        ${searchClause}
        ${activeClause}
    ),
    filtered AS (
      SELECT * FROM fr WHERE true
        ${overClause}
    )
    SELECT
      client_id,
      name,
      phone,
      is_active,
      credit_limit,
      account_balance,
      outstanding,
      (credit_limit + account_balance) AS headroom,
      (credit_limit + account_balance - outstanding) AS headroom_remaining,
      (credit_limit > 0 AND outstanding > (credit_limit + account_balance)) AS over_limit
    FROM filtered
    ORDER BY outstanding DESC, client_id ASC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return {
    total,
    page,
    limit,
    data: dataRows.map((r) => ({
      client_id: r.client_id,
      name: r.name,
      phone: r.phone,
      is_active: r.is_active,
      credit_limit: r.credit_limit.toString(),
      account_balance: r.account_balance.toString(),
      outstanding: r.outstanding.toString(),
      headroom: r.headroom.toString(),
      headroom_remaining: r.headroom_remaining.toString(),
      over_limit: r.over_limit
    }))
  };
}

