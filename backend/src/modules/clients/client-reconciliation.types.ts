/**
 * Mijoz bo‘yicha akt-sverka: bitta ma’lumot manbai — PDF, JSON API va Excel.
 */
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../orders/order-status";
import { buildClientReconciliationPdf, type ReconciliationPdfPayload } from "./client-reconciliation-pdf";

export type ClientReconciliationOrderRow = {
  number: string;
  created_at: string;
  total_sum: string;
  status: string;
  order_type: string;
};

export type ClientReconciliationPaymentRow = {
  id: number;
  created_at: string;
  amount: string;
  payment_type: string;
  note: string | null;
  order_number: string | null;
};

export type ClientReconciliationMovementRow = {
  created_at: string;
  delta: string;
  note: string | null;
};

export type ClientReconciliationChronoLine = {
  line_type: "order" | "payment" | "balance_movement";
  at: string;
  ref: string;
  debit: string;
  credit: string;
  description: string;
};

export type ClientReconciliationJsonResponse = {
  date_from: string;
  date_to: string;
  generated_at: string;
  tenant: { name: string };
  client: {
    id: number;
    name: string;
    legal_name: string | null;
    client_code: string | null;
    credit_limit: string;
  };
  summary: {
    account_balance_current: string;
    outstanding_orders_total: string;
    opening_balance_movements: string;
    period_movements_net: string;
    closing_balance_movements_at_period_end: string;
    sum_orders_in_period: string;
    sum_payments_in_period: string;
  };
  orders: ClientReconciliationOrderRow[];
  payments: ClientReconciliationPaymentRow[];
  balance_movements: ClientReconciliationMovementRow[];
  chronological: ClientReconciliationChronoLine[];
  notes: string[];
};

type OrderRow = {
  number: string;
  created_at: Date;
  total_sum: Prisma.Decimal;
  status: string;
  order_type: string;
};

type PaymentRow = Prisma.PaymentGetPayload<{
  include: { order: { select: { number: true } } };
}>;

function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLocalDateLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatLocalDateTimeLabel(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

function decStr(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

export type ClientReconciliationLoaded = {
  dateFromStart: Date;
  dateToEnd: Date;
  tenantName: string;
  client: {
    id: number;
    name: string;
    legal_name: string | null;
    client_code: string | null;
    credit_limit: Prisma.Decimal;
  };
  accountBalance: Prisma.Decimal;
  outstandingOrdersTotal: Prisma.Decimal;
  openingSum: Prisma.Decimal;
  periodMovementsSum: Prisma.Decimal;
  closingAtPeriodEnd: Prisma.Decimal;
  sumOrders: Prisma.Decimal;
  sumPayments: Prisma.Decimal;
  ordersInPeriod: OrderRow[];
  paymentsInPeriod: PaymentRow[];
  movementsInPeriod: Array<{ created_at: Date; delta: Prisma.Decimal; note: string | null }>;
};
