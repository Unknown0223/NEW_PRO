import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { decToString } from "./dashboard.helpers";
import type { FinanceDashboardFilters, FinanceProOpsBlock } from "./dashboard.finance.types";
import {
  financePeriodGranularity,
  financePeriodTruncSql
} from "./dashboard.finance.period";
import { financeClientFilterSql } from "./dashboard.finance.scope";
import { getCashDeskLedger, loadLedgerRefs } from "../cash-desks/cash-desk-ledger";
import { loadPaymentMethodEntriesForResolve } from "../tenant-settings/tenant-settings.service";
import { aggregatePaymentsByDisplayLabel } from "./dashboard.payment-labels";
import {
  ACCOUNT_COLORS,
  EXPENSE_COLORS,
  INCOME_COLORS,
  categoryRows,
  formatTxDate,
  mergeCashflowPeriods,
  pctChange,
  sparkFromSeries,
  statusLabel
} from "./dashboard.finance.pro-ops.helpers";

/**
 * NEW_PRO finance widgets uchun cash P&L / kassa / operatsiyalar bloki.
 * Sales/debt snapshotdan alohida — locality saqlanadi.
 */
export async function loadFinanceProOps(
  tenantId: number,
  filters: FinanceDashboardFilters,
  from: Date,
  to: Date
): Promise<FinanceProOpsBlock> {
  const spanMs = Math.max(86_400_000, to.getTime() - from.getTime() + 1);
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs + 1);
  const clientFilter = financeClientFilterSql(tenantId, filters);
  const granularity = financePeriodGranularity(from, to);
  const payPeriodExpr = financePeriodTruncSql(
    granularity,
    Prisma.sql`COALESCE(p.paid_at, p.created_at)`
  );
  const expPeriodExpr = financePeriodTruncSql(granularity, Prisma.sql`e.expense_date`);
  const todayYmd = new Date().toISOString().slice(0, 10);
  const payTypeFilter =
    filters.payment_types.length > 0
      ? Prisma.sql`AND btrim(COALESCE(p.payment_type, '')) IN (${Prisma.join(
          filters.payment_types.map((p) => Prisma.sql`${p}`)
        )})`
      : Prisma.empty;

  const [
    incomeNow,
    incomePrev,
    clientExpNow,
    clientExpPrev,
    deskExpNow,
    deskExpPrev,
    supplierNow,
    supplierPrev,
    payByPeriod,
    expByPeriod,
    clientExpByPeriod,
    paymentTypeRows,
    expenseTypeRows,
    recentRows,
    desks,
    scheduleRows
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'payment' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        ${payTypeFilter} AND ${clientFilter}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'payment' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${prevFrom}
        AND COALESCE(p.paid_at, p.created_at) <= ${prevTo}
        ${payTypeFilter} AND ${clientFilter}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'client_expense' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        AND ${clientFilter}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'client_expense' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${prevFrom}
        AND COALESCE(p.paid_at, p.created_at) <= ${prevTo}
        AND ${clientFilter}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(e.amount), 0)::numeric(15,2) AS s FROM expenses e
      WHERE e.tenant_id = ${tenantId} AND e.deleted_at IS NULL AND e.status = 'approved'
        AND e.expense_date >= ${from} AND e.expense_date <= ${to}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(e.amount), 0)::numeric(15,2) AS s FROM expenses e
      WHERE e.tenant_id = ${tenantId} AND e.deleted_at IS NULL AND e.status = 'approved'
        AND e.expense_date >= ${prevFrom} AND e.expense_date <= ${prevTo}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(sp.amount), 0)::numeric(15,2) AS s FROM supplier_payments sp
      WHERE sp.tenant_id = ${tenantId} AND sp.reversed_at IS NULL
        AND sp.paid_at >= ${from} AND sp.paid_at <= ${to}`,
    prisma.$queryRaw<Array<{ s: Prisma.Decimal }>>`
      SELECT COALESCE(SUM(sp.amount), 0)::numeric(15,2) AS s FROM supplier_payments sp
      WHERE sp.tenant_id = ${tenantId} AND sp.reversed_at IS NULL
        AND sp.paid_at >= ${prevFrom} AND sp.paid_at <= ${prevTo}`,
    prisma.$queryRaw<Array<{ period: Date; s: Prisma.Decimal }>>`
      SELECT ${payPeriodExpr} AS period, COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'payment' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        ${payTypeFilter} AND ${clientFilter}
      GROUP BY 1 ORDER BY 1 LIMIT 180`,
    prisma.$queryRaw<Array<{ period: Date; s: Prisma.Decimal }>>`
      SELECT ${expPeriodExpr} AS period, COALESCE(SUM(e.amount), 0)::numeric(15,2) AS s
      FROM expenses e
      WHERE e.tenant_id = ${tenantId} AND e.deleted_at IS NULL AND e.status = 'approved'
        AND e.expense_date >= ${from} AND e.expense_date <= ${to}
      GROUP BY 1 ORDER BY 1 LIMIT 180`,
    prisma.$queryRaw<Array<{ period: Date; s: Prisma.Decimal }>>`
      SELECT ${payPeriodExpr} AS period, COALESCE(SUM(p.amount), 0)::numeric(15,2) AS s
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'client_expense' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        AND ${clientFilter}
      GROUP BY 1 ORDER BY 1 LIMIT 180`,
    prisma.$queryRaw<Array<{ payment_type: string | null; amount: Prisma.Decimal }>>`
      SELECT NULLIF(TRIM(COALESCE(p.payment_type, '')), '') AS payment_type,
             COALESCE(SUM(p.amount), 0)::numeric(15,2) AS amount
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      WHERE p.tenant_id = ${tenantId} AND p.entry_kind = 'payment' AND p.deleted_at IS NULL
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        ${payTypeFilter} AND ${clientFilter}
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ name: string; amount: Prisma.Decimal }>>`
      SELECT COALESCE(NULLIF(TRIM(e.expense_type), ''), 'Прочее') AS name,
             COALESCE(SUM(e.amount), 0)::numeric(15,2) AS amount
      FROM expenses e
      WHERE e.tenant_id = ${tenantId} AND e.deleted_at IS NULL AND e.status = 'approved'
        AND e.expense_date >= ${from} AND e.expense_date <= ${to}
      GROUP BY 1 ORDER BY amount DESC LIMIT 12`,
    prisma.$queryRaw<
      Array<{
        id: number;
        amount: Prisma.Decimal;
        paid_at: Date | null;
        created_at: Date;
        payment_type: string | null;
        entry_kind: string;
        workflow_status: string;
        note: string | null;
        client_name: string | null;
        desk_name: string | null;
      }>
    >`
      SELECT p.id, p.amount, p.paid_at, p.created_at, p.payment_type, p.entry_kind::text AS entry_kind,
             p.workflow_status::text AS workflow_status, p.note, c.name AS client_name, cd.name AS desk_name
      FROM client_payments p
      JOIN clients c ON c.id = p.client_id
      LEFT JOIN users u ON u.id = c.agent_id
      LEFT JOIN cash_desks cd ON cd.id = p.cash_desk_id
      WHERE p.tenant_id = ${tenantId} AND p.deleted_at IS NULL
        AND p.entry_kind IN ('payment', 'client_expense')
        AND COALESCE(p.paid_at, p.created_at) >= ${from}
        AND COALESCE(p.paid_at, p.created_at) <= ${to}
        AND ${clientFilter}
      ORDER BY COALESCE(p.paid_at, p.created_at) DESC LIMIT 40`,
    prisma.cashDesk.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      take: 12,
      select: { id: true, name: true, is_closed: true }
    }),
    prisma.$queryRaw<
      Array<{
        id: number;
        expense_date: Date;
        expense_type: string;
        amount: Prisma.Decimal;
        note: string | null;
        desk_name: string | null;
      }>
    >`
      SELECT e.id, e.expense_date, e.expense_type, e.amount, e.note, cd.name AS desk_name
      FROM expenses e
      LEFT JOIN cash_desks cd ON cd.id = e.cash_desk_id
      WHERE e.tenant_id = ${tenantId} AND e.deleted_at IS NULL AND e.status = 'draft'
        AND e.expense_date::date >= ${todayYmd}::date
      ORDER BY e.expense_date ASC LIMIT 20`
  ]);

  const income = incomeNow[0]?.s ?? new Prisma.Decimal(0);
  const expense = (clientExpNow[0]?.s ?? new Prisma.Decimal(0))
    .add(deskExpNow[0]?.s ?? 0)
    .add(supplierNow[0]?.s ?? 0);
  const incomeP = incomePrev[0]?.s ?? new Prisma.Decimal(0);
  const expenseP = (clientExpPrev[0]?.s ?? new Prisma.Decimal(0))
    .add(deskExpPrev[0]?.s ?? 0)
    .add(supplierPrev[0]?.s ?? 0);
  const profit = income.sub(expense);
  const profitP = incomeP.sub(expenseP);

  const cashflow_by_period = mergeCashflowPeriods(payByPeriod, expByPeriod, clientExpByPeriod);
  const pmEntries = await loadPaymentMethodEntriesForResolve(tenantId);
  const income_categories = aggregatePaymentsByDisplayLabel(paymentTypeRows, pmEntries).map(
    (r, i) => ({
      name: r.payment_type,
      amount: r.amount,
      pct: r.share_pct,
      color: INCOME_COLORS[i % INCOME_COLORS.length]!
    })
  );

  const expenseMerged = [...expenseTypeRows];
  const clientExpTotal = clientExpNow[0]?.s ?? new Prisma.Decimal(0);
  if (clientExpTotal.gt(0)) expenseMerged.push({ name: "Расход клиента", amount: clientExpTotal });
  const supplierTotal = supplierNow[0]?.s ?? new Prisma.Decimal(0);
  if (supplierTotal.gt(0)) expenseMerged.push({ name: "Оплата поставщику", amount: supplierTotal });
  expenseMerged.sort((a, b) => b.amount.comparedTo(a.amount));
  const expense_categories = categoryRows(expenseMerged.slice(0, 8), EXPENSE_COLORS);

  const recent_transactions = recentRows.map((r) => {
    const isIncome = r.entry_kind === "payment";
    return {
      id: r.id,
      date: formatTxDate(r.paid_at ?? r.created_at),
      type: (isIncome ? "income" : "expense") as "income" | "expense" | "transfer",
      description: (r.note && r.note.trim()) || r.client_name || (isIncome ? "Оплата" : "Расход"),
      amount: decToString(r.amount),
      status: statusLabel(r.workflow_status),
      account: r.desk_name || "—",
      category:
        (r.payment_type && r.payment_type.trim()) || (isIncome ? "Оплата" : "Расход клиента")
    };
  });

  const refs = await loadLedgerRefs(prisma, tenantId);
  const accounts: FinanceProOpsBlock["accounts"] = [];
  let accountsBalance = new Prisma.Decimal(0);
  for (let i = 0; i < desks.length; i++) {
    const desk = desks[i]!;
    const ledger = await getCashDeskLedger(prisma, tenantId, desk.id, refs);
    const amount = ledger.by_currency[ledger.default_currency] ?? new Prisma.Decimal(0);
    accountsBalance = accountsBalance.add(amount);
    accounts.push({
      id: desk.id,
      name: desk.name,
      amount: decToString(amount),
      type: desk.is_closed ? "Закрыта" : "Касса",
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]!
    });
  }

  const scheduled_payments: FinanceProOpsBlock["scheduled_payments"] = scheduleRows.map((r) => ({
    id: r.id,
    date: r.expense_date.toISOString().slice(0, 10),
    name: (r.note && r.note.trim()) || r.expense_type,
    category: r.expense_type,
    account: r.desk_name || "—",
    amount: decToString(r.amount),
    status: "pending" as const
  }));

  const incomeSpark = sparkFromSeries(cashflow_by_period.map((r) => Number(r.income)));
  const expenseSpark = sparkFromSeries(cashflow_by_period.map((r) => Number(r.expense)));
  const profitSpark = sparkFromSeries(cashflow_by_period.map((r) => Number(r.profit)));
  const balanceSpark = sparkFromSeries(
    cashflow_by_period.map((r) => Number(r.income) - Number(r.expense))
  );

  return {
    total_income: decToString(income),
    total_expense: decToString(expense),
    total_profit: decToString(profit),
    accounts_balance: decToString(accountsBalance),
    income_change_pct: pctChange(income, incomeP),
    expense_change_pct: pctChange(expense, expenseP),
    profit_change_pct: pctChange(profit, profitP),
    balance_change_pct: null,
    income_spark: incomeSpark,
    expense_spark: expenseSpark,
    profit_spark: profitSpark,
    balance_spark: balanceSpark,
    cashflow_by_period,
    income_categories,
    expense_categories,
    recent_transactions,
    accounts,
    scheduled_payments
  };
}
