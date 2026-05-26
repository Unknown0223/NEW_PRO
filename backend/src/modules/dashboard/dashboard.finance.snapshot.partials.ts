import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
import type {
  FinanceBalanceBlock,
  FinanceCategoryRow,
  FinanceDashboardFilters,
  FinanceDashboardSnapshot,
  FinancePaymentTypeRow,
  FinancePeriodGranularity,
  FinancePeriodRow
} from "./dashboard.finance.types";
import {
  buildFinancePeriodBalance,
  financePeriodGranularity,
  financePeriodTruncSql
} from "./dashboard.finance.period";
import {
  financeClientFilterSql,
  financeDateExprByType,
  financeOrderScopeSql
} from "./dashboard.finance.scope";

export type FinanceDashboardSummaryPayload = Omit<FinanceDashboardSnapshot, "territory_debts" | "clients_debt_list">;

export async function buildFinanceScopes(tenantId: number, filters: FinanceDashboardFilters) {
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T23:59:59.999Z`);
  const orderScope = financeOrderScopeSql(tenantId, from, to, filters);
  const orderScopeO2 = financeOrderScopeSql(tenantId, from, to, filters, {
    aliases: { order: "o2", user: "u2", client: "c2" }
  });
  const receivableOrderScope = financeOrderScopeSql(tenantId, from, to, filters, {
    onlyReceivableStatuses: true
  });
  const clientFilter = financeClientFilterSql(tenantId, filters);
  return { from, to, orderScope, orderScopeO2, receivableOrderScope, clientFilter };
}

export async function getFinanceDashboardSummary(
  tenantId: number,
  filters: FinanceDashboardFilters
): Promise<FinanceDashboardSummaryPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:finance:summary:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<FinanceDashboardSummaryPayload>(snapshotKey);
  if (cached) return cached;

  const { from, to, orderScope, orderScopeO2, receivableOrderScope, clientFilter } =
    await buildFinanceScopes(tenantId, filters);
  const periodGranularity: FinancePeriodGranularity = financePeriodGranularity(from, to);
  const debtPeriodExpr = financePeriodTruncSql(
    periodGranularity,
    financeDateExprByType(filters.date_type)
  );
  const payPeriodExpr = financePeriodTruncSql(
    periodGranularity,
    Prisma.sql`COALESCE(p.paid_at, p.created_at)`
  );

  const [
    salesRows,
    returnsRows,
    paymentsRows,
    debtRows,
    categoryRows,
    paymentRows,
    balanceRows,
    debtClientRows,
    creditClientRows,
    periodRows
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(o.total_sum), 0)::numeric(15,2) AS s
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE ${orderScope}
    `,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(sr.refund_amount), 0)::numeric(15,2) AS s
      FROM sales_returns sr
      JOIN orders o ON o.id = sr.order_id
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      WHERE sr.tenant_id = ${tenantId}
        AND sr.status = 'posted'
        AND sr.created_at >= ${from}
        AND sr.created_at <= ${to}
        AND ${orderScope}
    `,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId}
        AND p.entry_kind = 'payment'
        AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        ${filters.payment_types.length > 0 ? Prisma.sql`AND btrim(COALESCE(p.payment_type, '')) IN (${Prisma.join(filters.payment_types.map((p) => Prisma.sql`${p}`))})` : Prisma.empty}
        AND ${clientFilter}
    `,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      WITH alloc AS (
        SELECT pa.order_id, SUM(pa.amount)::numeric(15,2) AS allocated
        FROM payment_allocations pa
        WHERE pa.tenant_id = ${tenantId}
        GROUP BY pa.order_id
      )
      SELECT COALESCE(SUM(GREATEST(o.total_sum - COALESCE(a.allocated, 0), 0)), 0)::numeric(15,2) AS s
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN alloc a ON a.order_id = o.id
      WHERE ${receivableOrderScope}
    `,
    prisma.$queryRaw<Array<{ category: string; sales_sum: Prisma.Decimal; order_count: bigint; grand_total: Prisma.Decimal }>>`
      SELECT
        COALESCE(pc.name, '—') AS category,
        COALESCE(SUM(oi.total), 0)::numeric(15,2) AS sales_sum,
        COUNT(DISTINCT o.id)::bigint AS order_count,
        (SELECT COALESCE(SUM(oi2.total), 0)::numeric(15,2) FROM order_items oi2 JOIN orders o2 ON oi2.order_id = o2.id JOIN users u2 ON u2.id = o2.agent_id JOIN clients c2 ON c2.id = o2.client_id JOIN products p2 ON p2.id = oi2.product_id LEFT JOIN product_categories pc2 ON pc2.id = p2.category_id WHERE ${orderScopeO2}) AS grand_total
      FROM orders o
      JOIN users u ON u.id = o.agent_id
      JOIN clients c ON c.id = o.client_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      WHERE ${orderScope}
      GROUP BY 1
      ORDER BY sales_sum DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ payment_type: string | null; amount: Prisma.Decimal }>>`
      SELECT
        NULLIF(TRIM(COALESCE(p.payment_type, '')), '') AS payment_type,
        COALESCE(SUM(p.amount), 0)::numeric(15,2) AS amount
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId}
        AND p.entry_kind = 'payment'
        AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        AND ${clientFilter}
      GROUP BY 1
      ORDER BY amount DESC
    `,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(cb.balance), 0)::numeric(15,2) AS s
      FROM client_balances cb
      JOIN clients c ON c.id = cb.client_id
      WHERE cb.tenant_id = ${tenantId}
        AND ${clientFilter}
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM client_balances cb
      JOIN clients c ON c.id = cb.client_id
      WHERE cb.tenant_id = ${tenantId}
        AND cb.balance < 0
        AND ${clientFilter}
    `,
    prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c
      FROM client_balances cb
      JOIN clients c ON c.id = cb.client_id
      WHERE cb.tenant_id = ${tenantId}
        AND cb.balance > 0
        AND ${clientFilter}
    `,
    prisma.$queryRaw<Array<{ period: string; debt_sum: Prisma.Decimal; payment_sum: Prisma.Decimal }>>`
      WITH debts AS (
        SELECT
          ${debtPeriodExpr} AS p,
          SUM(o.total_sum)::numeric(15,2) AS v
        FROM orders o
        JOIN users u ON u.id = o.agent_id
        JOIN clients c ON c.id = o.client_id
        WHERE ${receivableOrderScope}
        GROUP BY 1
      ),
      pays AS (
        SELECT
          ${payPeriodExpr} AS p,
          SUM(p.amount)::numeric(15,2) AS v
        FROM client_payments p
        JOIN clients c ON c.id = p.client_id
        LEFT JOIN users u ON u.id = c.agent_id
        WHERE p.tenant_id = ${tenantId}
          AND p.entry_kind = 'payment'
          AND p.deleted_at IS NULL
          AND COALESCE(p.paid_at, p.created_at) >= ${from}
          AND COALESCE(p.paid_at, p.created_at) <= ${to}
          AND ${clientFilter}
        GROUP BY 1
      )
      SELECT
        COALESCE(d.p::text, y.p::text) AS period,
        COALESCE(d.v, 0)::numeric(15,2) AS debt_sum,
        COALESCE(y.v, 0)::numeric(15,2) AS payment_sum
      FROM debts d
      FULL OUTER JOIN pays y ON y.p = d.p
      ORDER BY period ASC
      LIMIT 180
    `
  ]);

  const totalSales = salesRows[0]?.s ?? new Prisma.Decimal(0);
  const totalReturns = returnsRows[0]?.s ?? new Prisma.Decimal(0);
  const totalPayments = paymentsRows[0]?.s ?? new Prisma.Decimal(0);
  const totalDebt = debtRows[0]?.s ?? new Prisma.Decimal(0);
  const netSales = totalSales.sub(totalReturns);
  const debtRatioPct = netSales.gt(0) ? clampPct(totalDebt.div(netSales).mul(100).toNumber()) : 0;

  const catGrand = categoryRows[0]?.grand_total ?? new Prisma.Decimal(0);
  const category_analytics: FinanceCategoryRow[] = categoryRows.map((r) => ({
    category: r.category,
    sales_sum: r.sales_sum.toString(),
    sales_share_pct: catGrand.gt(0) ? clampPct(r.sales_sum.div(catGrand).mul(100).toNumber()) : 0,
    order_count: Number(r.order_count)
  }));

  const payGrand = paymentRows.reduce((acc, r) => acc.add(r.amount), new Prisma.Decimal(0));
  const payment_type_analytics: FinancePaymentTypeRow[] = paymentRows.map((r) => ({
    payment_type: r.payment_type || "—",
    amount: r.amount.toString(),
    share_pct: payGrand.gt(0) ? clampPct(r.amount.div(payGrand).mul(100).toNumber()) : 0
  }));

  const general_balance: FinanceBalanceBlock = {
    total_balance: (balanceRows[0]?.s ?? new Prisma.Decimal(0)).toString(),
    debt_clients_count: Number(debtClientRows[0]?.c ?? 0n),
    credit_clients_count: Number(creditClientRows[0]?.c ?? 0n)
  };

  const debt_and_payment_by_period: FinancePeriodRow[] = periodRows.map((r) => ({
    period: r.period,
    debt_sum: r.debt_sum.toString(),
    payment_sum: r.payment_sum.toString()
  }));

  const period_balance = buildFinancePeriodBalance(paymentRows, totalPayments, totalDebt);

  const result: FinanceDashboardSummaryPayload = {
    filters,
    summary: {
      total_sales_sum: totalSales.toString(),
      total_payments_sum: totalPayments.toString(),
      total_returns_sum: totalReturns.toString(),
      net_sales_sum: netSales.toString(),
      outstanding_debt_sum: totalDebt.toString(),
      debt_ratio_pct: debtRatioPct
    },
    category_analytics,
    payment_type_analytics,
    general_balance,
    debt_and_payment_by_period,
    period_balance,
    period_granularity: periodGranularity
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
