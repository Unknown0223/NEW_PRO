import { Prisma } from "@prisma/client";
import { decToString } from "./dashboard.helpers";
import type { FinancePeriodBalanceBlock } from "./dashboard.finance.types";

export type FinancePeriodGranularity = "day" | "week" | "month";

export function financePeriodGranularity(from: Date, to: Date): FinancePeriodGranularity {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000) + 1);
  if (days > 120) return "month";
  if (days > 35) return "week";
  return "day";
}

export function financePeriodTruncSql(
  unit: FinancePeriodGranularity,
  dateExpr: Prisma.Sql
): Prisma.Sql {
  switch (unit) {
    case "month":
      return Prisma.sql`DATE_TRUNC('month', ${dateExpr})::date`;
    case "week":
      return Prisma.sql`DATE_TRUNC('week', ${dateExpr})::date`;
    default:
      return Prisma.sql`DATE_TRUNC('day', ${dateExpr})::date`;
  }
}

type PaymentRow = { payment_type: string | null; amount: Prisma.Decimal };

function bucketPayments(rows: PaymentRow[]) {
  const buckets = {
    cash: new Prisma.Decimal(0),
    transfer: new Prisma.Decimal(0),
    terminal: new Prisma.Decimal(0),
    tenge: new Prisma.Decimal(0)
  };
  for (const row of rows) {
    const key = (row.payment_type ?? "").trim().toLowerCase();
    const amt = row.amount;
    if (key.includes("tenge")) buckets.tenge = buckets.tenge.add(amt);
    else if (key.includes("terminal")) buckets.terminal = buckets.terminal.add(amt);
    else if (key.includes("transfer") || key.includes("perech")) buckets.transfer = buckets.transfer.add(amt);
    else if (key.includes("cash") || key.includes("naqd")) buckets.cash = buckets.cash.add(amt);
  }
  return buckets;
}

/** Shablon `periodBalance`: UZS = net (оплаты − долг), kanallar = оплаты по типу. */
export function buildFinancePeriodBalance(
  paymentRows: PaymentRow[],
  totalPayments: Prisma.Decimal,
  totalDebt: Prisma.Decimal
): FinancePeriodBalanceBlock {
  const channels = bucketPayments(paymentRows);
  const net = totalPayments.sub(totalDebt);
  return {
    uzs: decToString(net),
    cash: decToString(channels.cash),
    transfer: decToString(channels.transfer),
    terminal: decToString(channels.terminal),
    tenge: decToString(channels.tenge)
  };
}
