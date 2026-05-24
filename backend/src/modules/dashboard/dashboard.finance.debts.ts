import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { decToString } from "./dashboard.helpers";
import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
import type {
  FinanceClientDebtRow,
  FinanceDashboardFilters,
  FinanceDashboardSnapshot,
  FinanceTerritoryDebtRow
} from "./dashboard.finance.types";
import { buildFinanceScopes } from "./dashboard.finance.snapshot.partials";

export type FinanceDashboardDebtsPayload = Pick<
  FinanceDashboardSnapshot,
  "filters" | "territory_debts" | "clients_debt_list"
> & {
  clients_total: number;
  page: number;
  limit: number;
};

export async function getFinanceDashboardDebts(
  tenantId: number,
  filters: FinanceDashboardFilters,
  opts: { page?: number; limit?: number } = {}
): Promise<FinanceDashboardDebtsPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const snapshotKey = `tenant:${tenantId}:dashboard:finance:debts:${stableJsonStringify({ filters, page, limit })}`;
  const cached = await getSnapshotCache<FinanceDashboardDebtsPayload>(snapshotKey);
  if (cached) return cached;

  const { receivableOrderScope, clientFilter } = await buildFinanceScopes(tenantId, filters);
  const offset = (page - 1) * limit;

  const [territoryRows, countRows, clientsDebtRows] = await Promise.all([
    prisma.$queryRaw<Array<{ territory: string; debt_sum: Prisma.Decimal; debtors_count: bigint }>>`
      WITH alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
        GROUP BY pa.order_id
      ),
      debt_orders AS (
        SELECT
          o.client_id,
          GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0)::numeric(15,2) AS debt
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        LEFT JOIN alloc a ON a.order_id = o.id
        WHERE ${receivableOrderScope}
      )
      SELECT
        COALESCE(NULLIF(TRIM(c.region), ''), NULLIF(TRIM(c.city), ''), NULLIF(TRIM(c.zone), ''), '—') AS territory,
        COALESCE(SUM(d.debt), 0)::numeric(15,2) AS debt_sum,
        COUNT(DISTINCT d.client_id)::bigint AS debtors_count
      FROM debt_orders d
      JOIN clients c ON c.id = d.client_id
      WHERE d.debt > 0
      GROUP BY 1
      ORDER BY debt_sum DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      WITH alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
        GROUP BY pa.order_id
      ),
      debt_by_client AS (
        SELECT
          o.client_id,
          COALESCE(SUM(GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0)), 0)::numeric(15,2) AS delivered_debt
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        LEFT JOIN alloc a ON a.order_id = o.id
        WHERE ${receivableOrderScope}
        GROUP BY o.client_id
      )
      SELECT COUNT(*)::bigint AS c
      FROM clients c
      LEFT JOIN client_balances cb ON cb.client_id = c.id AND cb.tenant_id = ${tenantId}
      LEFT JOIN debt_by_client db ON db.client_id = c.id
      WHERE ${clientFilter}
        AND LEAST(COALESCE(cb.balance, 0), -COALESCE(db.delivered_debt, 0)) < 0
    `,
    prisma.$queryRaw<
      Array<{
        client_id: number;
        client_name: string;
        agent_name: string | null;
        supervisor_name: string | null;
        territory: string | null;
        ledger_balance: Prisma.Decimal;
        delivered_debt: Prisma.Decimal;
        effective_balance: Prisma.Decimal;
      }>
    >`
      WITH alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
        GROUP BY pa.order_id
      ),
      debt_by_client AS (
        SELECT
          o.client_id,
          COALESCE(SUM(GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0)), 0)::numeric(15,2) AS delivered_debt
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        LEFT JOIN alloc a ON a.order_id = o.id
        WHERE ${receivableOrderScope}
        GROUP BY o.client_id
      )
      SELECT
        c.id AS client_id,
        c.name AS client_name,
        ag.name AS agent_name,
        su.name AS supervisor_name,
        COALESCE(NULLIF(TRIM(c.region), ''), NULLIF(TRIM(c.city), ''), NULLIF(TRIM(c.zone), '')) AS territory,
        COALESCE(cb.balance, 0)::numeric(15,2) AS ledger_balance,
        COALESCE(db.delivered_debt, 0)::numeric(15,2) AS delivered_debt,
        LEAST(COALESCE(cb.balance, 0), -COALESCE(db.delivered_debt, 0))::numeric(15,2) AS effective_balance
      FROM clients c
      LEFT JOIN client_balances cb ON cb.client_id = c.id AND cb.tenant_id = ${tenantId}
      LEFT JOIN debt_by_client db ON db.client_id = c.id
      LEFT JOIN users ag ON ag.id = c.agent_id
      LEFT JOIN users su ON su.id = ag.supervisor_user_id
      WHERE ${clientFilter}
        AND LEAST(COALESCE(cb.balance, 0), -COALESCE(db.delivered_debt, 0)) < 0
      ORDER BY effective_balance ASC
      LIMIT ${limit} OFFSET ${offset}
    `
  ]);

  const territory_debts: FinanceTerritoryDebtRow[] = territoryRows.map((r) => ({
    territory: r.territory,
    debt_sum: r.debt_sum.toString(),
    debtors_count: Number(r.debtors_count)
  }));

  const clients_debt_list: FinanceClientDebtRow[] = clientsDebtRows.map((r) => ({
    client_id: r.client_id,
    client_name: r.client_name,
    agent_name: r.agent_name,
    supervisor_name: r.supervisor_name,
    territory: r.territory,
    ledger_balance: decToString(r.ledger_balance),
    delivered_debt: decToString(r.delivered_debt),
    effective_balance: decToString(r.effective_balance)
  }));

  const result: FinanceDashboardDebtsPayload = {
    filters,
    territory_debts,
    clients_debt_list,
    clients_total: Number(countRows[0]?.c ?? 0n),
    page,
    limit
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
