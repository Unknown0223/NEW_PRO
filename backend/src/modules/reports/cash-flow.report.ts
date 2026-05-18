import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PaymentMethodEntryDto } from "../tenant-settings/finance-refs";
import {
  paymentMethodStorageKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries
} from "../tenant-settings/finance-refs";
import type { CashFlowReportPayload, CashFlowTableChild, CashFlowTableRow, Split } from "./cash-flow.types";
import {
  add,
  aggregateExpensesApproved,
  aggregatePaymentsDesk,
  decStr,
  foldOpeningOnly,
  foldPeriodIncomeExpense,
  parseDayEndUtc,
  parseDayStartUtc,
  splitTotal,
  sub
} from "./cash-flow.helpers";
import { resolveCashDeskIdForReport } from "./cash-flow.resolve";

export async function getCashFlowReport(
  tenantId: number,
  params: { date_from: string; date_to: string; cash_desk_id: number }
): Promise<CashFlowReportPayload> {
  const dayStart = parseDayStartUtc(params.date_from);
  const dayEnd = parseDayEndUtc(params.date_to);
  if (dayStart.getTime() > dayEnd.getTime()) throw new Error("BAD_RANGE");

  const desk = await prisma.cashDesk.findFirst({
    where: { id: params.cash_desk_id, tenant_id: tenantId }
  });
  if (!desk) throw new Error("BAD_CASH_DESK");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  const ref = (tenant?.settings as Record<string, unknown> | null)?.references as Record<string, unknown> | undefined;
  const currencies = resolveCurrencyEntries(ref ?? {});
  const methods = resolvePaymentMethodEntries(ref ?? {}, currencies);

  const [rowsBefore, rowsInside, expenseRows, lastShift] = await Promise.all([
    aggregatePaymentsDesk(tenantId, desk.id, "before", dayStart, dayEnd),
    aggregatePaymentsDesk(tenantId, desk.id, "inside", dayStart, dayEnd),
    aggregateExpensesApproved(tenantId, dayStart, dayEnd),
    prisma.cashDeskShift.findFirst({
      where: {
        tenant_id: tenantId,
        cash_desk_id: desk.id,
        closed_at: { not: null, lt: dayStart }
      },
      orderBy: { closed_at: "desc" },
      select: { closed_at: true, closing_float: true, opening_float: true }
    })
  ]);

  const opening = foldOpeningOnly(rowsBefore, methods);
  const { incomePayment, incomeOther, expenseClient } = foldPeriodIncomeExpense(rowsInside, methods);

  let expenseCompany = new Prisma.Decimal(0);
  const expenseChildren: CashFlowTableChild[] = [];
  for (const er of expenseRows) {
    expenseCompany = expenseCompany.add(er.s);
    expenseChildren.push({
      key: `exp-comp-${er.expense_type}`,
      label: er.expense_type,
      terminal: "0.00",
      cash: decStr(er.s),
      total: decStr(er.s)
    });
  }

  const expenseCompanySplit: Split = { terminal: new Prisma.Decimal(0), cash: expenseCompany };

  const incomeSectionTotal = add(incomePayment, incomeOther);
  const expenseTotal = add(expenseClient, expenseCompanySplit);
  const periodNet = sub(incomeSectionTotal, expenseTotal);
  const closing = add(opening, periodNet);
  const expenseSectionTotal = expenseTotal;

  const incTot = incomeSectionTotal.terminal.add(incomeSectionTotal.cash);
  let terminal_share_pct: number | null = null;
  let cash_share_pct: number | null = null;
  if (incTot.gt(0)) {
    terminal_share_pct = incomeSectionTotal.terminal.mul(100).div(incTot).toDecimalPlaces(2).toNumber();
    cash_share_pct = incomeSectionTotal.cash.mul(100).div(incTot).toDecimalPlaces(2).toNumber();
  }

  const data_model_mapping = [
    { concept: "Касса (cashbox)", source: "cash_desks", comment: "id или code/name как cashbox_id" },
    {
      concept: "Остаток на начало (идеал: cashbox_balance)",
      source: "client_payments до date_from",
      comment: "опционально сверка с closing_float последней смены (cash_desk_shifts)"
    },
    { concept: "Приход (income)", source: "client_payments.entry_kind=payment", comment: "confirmed, по кассе" },
    {
      concept: "Расход (expense)",
      source: "client_payments.entry_kind=client_expense + expenses(status=approved)",
      comment: "expenses без cash_desk_id — в колонку Naqd"
    },
    { concept: "Terminal / Naqd", source: "tenant.settings.references.payment_method_entries", comment: "маппинг payment_type" },
    {
      concept: "Возврат клиенту (refund)",
      source: "—",
      comment: "отдельная сумма из sales_returns.refund_amount в отчёт не включена (нет привязки к кассе)"
    }
  ];

  const rows: CashFlowTableRow[] = [
    {
      key: "opening",
      kind: "opening",
      label: "Остаток на начало периода",
      ...splitTotal(opening),
      children: []
    },
    {
      key: "income",
      kind: "income",
      label: "Приход",
      ...splitTotal(incomeSectionTotal),
      children: [
        {
          key: "in-client",
          label: "Оплаты клиента",
          ...splitTotal(incomePayment)
        },
        {
          key: "in-other",
          label: "Прочие оплаты",
          ...splitTotal(incomeOther)
        }
      ]
    },
    {
      key: "expense",
      kind: "expense",
      label: "Расход",
      ...splitTotal(expenseSectionTotal),
      children: [
        {
          key: "ex-client",
          label: "Расход клиента (учёт)",
          ...splitTotal(expenseClient)
        },
        ...(expenseChildren.length
          ? expenseChildren
          : [
              {
                key: "ex-desk",
                label: "Расходы из кассы",
                terminal: "0.00",
                cash: "0.00",
                total: "0.00"
              }
            ])
      ]
    },
    {
      key: "closing",
      kind: "closing",
      label: "Остаток на конец периода",
      ...splitTotal(closing),
      children: []
    }
  ];

  const notes = [
    "Остаток на начало = сумма подтверждённых движений по выбранной кассе до начала периода (оплаты +, расход клиента −), дата: COALESCE(paid_at, confirmed_at, created_at).",
    "Расходы «из кассы» — одобренные записи expenses за период по тенанту (поле cash_desk в расходах пока не используется); суммы отнесены в колонку Naqd.",
    "Начальные балансы клиентов (client_opening_balance_entries) в расчёт opening не включены — только client_payments.",
    "Риск дубля: одна и та же операция не должна дублироваться в payment и в отдельном cash_transaction (у нас только client_payments).",
    "Closing = Opening + Income − Expense по каждой колонке Terminal/Naqd; итог по строкам согласован с формулой."
  ];

  return {
    date_from: params.date_from.trim(),
    date_to: params.date_to.trim(),
    cash_desk: { id: desk.id, name: desk.name, code: desk.code ?? null },
    summary: {
      opening: splitTotal(opening),
      income: splitTotal(incomeSectionTotal),
      expense: splitTotal(expenseSectionTotal),
      closing: splitTotal(closing)
    },
    payment_type_breakdown: {
      period_income: splitTotal(incomeSectionTotal),
      terminal_share_pct: terminal_share_pct,
      cash_share_pct: cash_share_pct
    },
    opening_hint: {
      last_closed_shift:
        lastShift?.closed_at != null
          ? {
              closed_at: lastShift.closed_at.toISOString(),
              closing_float: lastShift.closing_float != null ? decStr(lastShift.closing_float) : null,
              opening_float: lastShift.opening_float != null ? decStr(lastShift.opening_float) : null
            }
          : null
    },
    data_model_mapping,
    ledger: {
      formula: "B_period_end = B_period_start + I_period - E_period (по Terminal и Naqd отдельно)",
      closing_equals: "opening + income - expense; при нулевых I и E closing = opening"
    },
    table: { rows },
    notes
  };
}
