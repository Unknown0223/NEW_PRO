import { buildClientReconciliationPdf, type ReconciliationPdfPayload } from "./client-reconciliation-pdf";
import type {
  ClientReconciliationChronoLine,
  ClientReconciliationJsonResponse,
  ClientReconciliationLoaded
} from "./client-reconciliation.types";
import {
  buildChronological,
  decStr,
  formatLocalDateLabel,
  formatLocalDateTimeLabel,
  formatLocalYmd
} from "./client-reconciliation.shared";

export function toReconciliationPdfPayload(loaded: ClientReconciliationLoaded): ReconciliationPdfPayload {
  const c = loaded.client;
  return {
    tenantName: loaded.tenantName,
    clientName: c.name,
    clientLegalName: c.legal_name,
    clientId: c.id,
    clientCode: c.client_code,
    dateFromLabel: formatLocalDateLabel(loaded.dateFromStart),
    dateToLabel: formatLocalDateLabel(loaded.dateToEnd),
    generatedAtLabel: formatLocalDateTimeLabel(new Date()),
    accountBalance: loaded.accountBalance.toString(),
    outstandingOrdersTotal: loaded.outstandingOrdersTotal.toString(),
    creditLimit: c.credit_limit.toString(),
    openingAccountBalance: loaded.openingSum.toString(),
    closingAccountBalanceAtPeriodEnd: loaded.closingAtPeriodEnd.toString(),
    sumOrdersInPeriod: loaded.sumOrders.toString(),
    sumPaymentsInPeriod: loaded.sumPayments.toString(),
    sumMovementDeltasInPeriod: loaded.periodMovementsSum.toString(),
    ordersInPeriod: loaded.ordersInPeriod.map((o) => ({
      number: o.number,
      created_at: o.created_at.toISOString(),
      total_sum: o.total_sum.toString(),
      status: o.status,
      order_type: o.order_type
    })),
    paymentsInPeriod: loaded.paymentsInPeriod.map((p) => ({
      id: p.id,
      created_at: p.created_at.toISOString(),
      amount: p.amount.toString(),
      payment_type: p.payment_type,
      note: p.note,
      order_number: p.order?.number ?? null
    })),
    movementsInPeriod: loaded.movementsInPeriod.map((m) => ({
      created_at: m.created_at.toISOString(),
      delta: m.delta.toString(),
      note: m.note
    }))
  };
}

export async function buildClientReconciliationPdfBufferFromLoaded(loaded: ClientReconciliationLoaded): Promise<Buffer> {
  return buildClientReconciliationPdf(toReconciliationPdfPayload(loaded));
}

export function toClientReconciliationJson(loaded: ClientReconciliationLoaded): ClientReconciliationJsonResponse {
  const c = loaded.client;
  const chronological = buildChronological(loaded);
  const notes = [
    "Остаток по движениям л/с на начало периода — сумма delta по client_balance_movements до date_from.",
    "Заказы и оплаты в таблицах — отдельные документы за период; хронология объединяет заказы, оплаты и движения л/с (одна оплата может иметь и строку оплаты, и строку движения — это отражение учёта в системе).",
    "Сальдо по лицевому счёту «текущее» (account_balance_current) — актуальный баланс в client_balances, не обязательно равен closing только по движениям за период.",
    "Открытая дебиторская задолженность по заказам (outstanding_orders_total) — сумма заказов в статусах, учитываемых в кредитной экспозиции, без вычета оплат по строкам заказа в этом поле."
  ];
  return {
    date_from: formatLocalYmd(loaded.dateFromStart),
    date_to: formatLocalYmd(loaded.dateToEnd),
    generated_at: new Date().toISOString(),
    tenant: { name: loaded.tenantName },
    client: {
      id: c.id,
      name: c.name,
      legal_name: c.legal_name,
      client_code: c.client_code,
      credit_limit: c.credit_limit.toString()
    },
    summary: {
      account_balance_current: loaded.accountBalance.toString(),
      outstanding_orders_total: loaded.outstandingOrdersTotal.toString(),
      opening_balance_movements: loaded.openingSum.toString(),
      period_movements_net: loaded.periodMovementsSum.toString(),
      closing_balance_movements_at_period_end: loaded.closingAtPeriodEnd.toString(),
      sum_orders_in_period: loaded.sumOrders.toString(),
      sum_payments_in_period: loaded.sumPayments.toString()
    },
    orders: loaded.ordersInPeriod.map((o) => ({
      number: o.number,
      created_at: o.created_at.toISOString(),
      total_sum: o.total_sum.toString(),
      status: o.status,
      order_type: o.order_type
    })),
    payments: loaded.paymentsInPeriod.map((p) => ({
      id: p.id,
      created_at: p.created_at.toISOString(),
      amount: p.amount.toString(),
      payment_type: p.payment_type,
      note: p.note,
      order_number: p.order?.number ?? null
    })),
    balance_movements: loaded.movementsInPeriod.map((m) => ({
      created_at: m.created_at.toISOString(),
      delta: m.delta.toString(),
      note: m.note
    })),
    chronological,
    notes
  };
}
