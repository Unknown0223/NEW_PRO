import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { enrichScopedReportActor, buildScopedAgentExistsSql } from "../access/access-agent-scope";
import type { ReportActor } from "./client-sales-4-report.service";
import {
  balanceDebtFlagLabel,
  resolveBalanceDebtFlag
} from "./balance-control-report.parse";
import type {
  BalanceControlReportFilters,
  BalanceControlReportRow,
  BalanceControlReportTotals
} from "./balance-control-report.types";

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateEnd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function sqlInStrings(values: string[]): Prisma.Sql {
  if (values.length === 0) return Prisma.sql`NULL`;
  return Prisma.join(values.map((t) => Prisma.sql`${t}`));
}

function decStr(v: Prisma.Decimal | number | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

type Raw = {
  client_id: number;
  client_name: string;
  agent_name: string;
  client_category: string;
  territory: string | null;
  balance: Prisma.Decimal;
  period_sales: Prisma.Decimal;
  period_payments: Prisma.Decimal;
  total_count: bigint;
  sum_clients: bigint;
  sum_balance: Prisma.Decimal;
  sum_sales: Prisma.Decimal;
  sum_payments: Prisma.Decimal;
};

export async function getBalanceControlReport(
  tenantId: number,
  f: BalanceControlReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const from = parseDate(f.from);
  const to = parseDateEnd(f.to);
  const offset = (f.page - 1) * f.limit;

  const clientParts: Prisma.Sql[] = [
    Prisma.sql`c.tenant_id = ${tenantId}`,
    Prisma.sql`c.merged_into_client_id IS NULL`
  ];
  if (f.agent_ids.length) {
    clientParts.push(Prisma.sql`c.agent_id IN (${Prisma.join(f.agent_ids)})`);
  }
  if (f.client_categories.length) {
    clientParts.push(Prisma.sql`COALESCE(c.category, '') IN (${sqlInStrings(f.client_categories)})`);
  }
  if (f.territory_1_list.length) {
    clientParts.push(Prisma.sql`COALESCE(c.zone, '') IN (${sqlInStrings(f.territory_1_list)})`);
  }
  if (f.territory_2_list.length) {
    clientParts.push(Prisma.sql`COALESCE(c.region, '') IN (${sqlInStrings(f.territory_2_list)})`);
  }
  if (f.territory_3_list.length) {
    clientParts.push(Prisma.sql`COALESCE(c.city, '') IN (${sqlInStrings(f.territory_3_list)})`);
  }
  const search = f.search?.trim();
  if (search) {
    const esc = search.replace(/%/g, "\\%").replace(/_/g, "\\_");
    const pat = `%${esc}%`;
    clientParts.push(
      Prisma.sql`(
        COALESCE(c.name, '') ILIKE ${pat}
        OR COALESCE(ag.name, '') ILIKE ${pat}
        OR COALESCE(c.phone, '') ILIKE ${pat}
      )`
    );
  }
  if (scopedActor) {
    clientParts.push(buildScopedAgentExistsSql(tenantId, Prisma.sql`c.agent_id`, scopedActor));
  }
  const clientWhereSql = Prisma.join(clientParts, " AND ");

  const salesDateSql =
    from && to
      ? Prisma.sql`AND o.created_at >= ${from} AND o.created_at <= ${to}`
      : from
        ? Prisma.sql`AND o.created_at >= ${from}`
        : to
          ? Prisma.sql`AND o.created_at <= ${to}`
          : Prisma.empty;

  const payDateSql =
    from && to
      ? Prisma.sql`AND COALESCE(p.paid_at, p.received_at, p.confirmed_at, p.created_at) >= ${from}
          AND COALESCE(p.paid_at, p.received_at, p.confirmed_at, p.created_at) <= ${to}`
      : from
        ? Prisma.sql`AND COALESCE(p.paid_at, p.received_at, p.confirmed_at, p.created_at) >= ${from}`
        : to
          ? Prisma.sql`AND COALESCE(p.paid_at, p.received_at, p.confirmed_at, p.created_at) <= ${to}`
          : Prisma.empty;

  let balanceHaving = Prisma.empty;
  if (f.balance_filter === "debt") {
    balanceHaving = Prisma.sql`AND b.balance < 0`;
  } else if (f.balance_filter === "credit") {
    balanceHaving = Prisma.sql`AND b.balance > 0`;
  } else if (f.balance_filter === "zero") {
    balanceHaving = Prisma.sql`AND b.balance = 0`;
  }

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH period_sales AS (
      SELECT
        o.client_id,
        COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS period_sales
      FROM orders o
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status <> 'cancelled'
        ${salesDateSql}
      GROUP BY o.client_id
    ),
    period_payments AS (
      SELECT
        p.client_id,
        COALESCE(SUM(p.amount), 0)::numeric(15,2) AS period_payments
      FROM client_payments p
      WHERE p.tenant_id = ${tenantId}
        AND p.deleted_at IS NULL
        AND p.entry_kind = 'payment'
        ${payDateSql}
      GROUP BY p.client_id
    ),
    base AS (
      SELECT
        c.id AS client_id,
        COALESCE(NULLIF(c.name, ''), '—') AS client_name,
        COALESCE(ag.name, '') AS agent_name,
        COALESCE(c.category, '') AS client_category,
        NULLIF(
          TRIM(BOTH ' · ' FROM CONCAT_WS(' · ', NULLIF(c.zone, ''), NULLIF(c.region, ''), NULLIF(c.city, ''))),
          ''
        ) AS territory,
        COALESCE(cb.balance, 0)::numeric(15,2) AS balance,
        COALESCE(ps.period_sales, 0)::numeric(15,2) AS period_sales,
        COALESCE(pp.period_payments, 0)::numeric(15,2) AS period_payments
      FROM clients c
      LEFT JOIN client_balances cb ON cb.client_id = c.id AND cb.tenant_id = c.tenant_id
      LEFT JOIN users ag ON ag.id = c.agent_id AND ag.tenant_id = c.tenant_id
      LEFT JOIN period_sales ps ON ps.client_id = c.id
      LEFT JOIN period_payments pp ON pp.client_id = c.id
      WHERE ${clientWhereSql}
        AND (
          COALESCE(cb.balance, 0) <> 0
          OR COALESCE(ps.period_sales, 0) <> 0
          OR COALESCE(pp.period_payments, 0) <> 0
        )
    ),
    filtered AS (
      SELECT * FROM base b
      WHERE TRUE
        ${balanceHaving}
    ),
    totals AS (
      SELECT
        COUNT(*)::bigint AS sum_clients,
        COALESCE(SUM(balance), 0)::numeric(15,2) AS sum_balance,
        COALESCE(SUM(period_sales), 0)::numeric(15,2) AS sum_sales,
        COALESCE(SUM(period_payments), 0)::numeric(15,2) AS sum_payments
      FROM filtered
    )
    SELECT
      f.client_id,
      f.client_name,
      f.agent_name,
      f.client_category,
      f.territory,
      f.balance,
      f.period_sales,
      f.period_payments,
      COUNT(*) OVER()::bigint AS total_count,
      t.sum_clients,
      t.sum_balance,
      t.sum_sales,
      t.sum_payments
    FROM filtered f
    CROSS JOIN totals t
    ORDER BY f.balance ASC, f.client_name ASC, f.client_id ASC
    LIMIT ${f.limit} OFFSET ${offset}
  `;

  const mapped: BalanceControlReportRow[] = rows.map((r, idx) => {
    const balance = decStr(r.balance);
    const debtFlag = resolveBalanceDebtFlag(balance);
    return {
      row_number: offset + idx + 1,
      client_id: r.client_id,
      client_name: r.client_name ?? "",
      agent_name: r.agent_name ?? "",
      client_category: r.client_category ?? "",
      territory: r.territory ?? "",
      balance,
      period_sales: decStr(r.period_sales),
      period_payments: decStr(r.period_payments),
      debt_flag: debtFlag,
      debt_flag_label: balanceDebtFlagLabel(debtFlag)
    };
  });

  const totals: BalanceControlReportTotals = {
    client_count: Number(rows[0]?.sum_clients ?? 0),
    balance_sum: decStr(rows[0]?.sum_balance),
    period_sales_sum: decStr(rows[0]?.sum_sales),
    period_payments_sum: decStr(rows[0]?.sum_payments)
  };

  return {
    period_from: f.from,
    period_to: f.to,
    page: f.page,
    limit: f.limit,
    total: Number(rows[0]?.total_count ?? 0),
    totals,
    rows: mapped
  };
}