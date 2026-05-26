import type { FinancePaymentTypeRow } from "@/components/dashboard/finance/types";

export type PaymentChannelBuckets = {
  cash: number;
  transfer: number;
  terminal: number;
  tenge: number;
};

export function bucketPaymentChannels(rows: FinancePaymentTypeRow[]): PaymentChannelBuckets {
  const buckets: PaymentChannelBuckets = { cash: 0, transfer: 0, terminal: 0, tenge: 0 };
  for (const row of rows) {
    const key = row.payment_type.trim().toLowerCase();
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    if (key.includes("tenge")) buckets.tenge += amount;
    else if (key.includes("terminal")) buckets.terminal += amount;
    else if (key.includes("transfer") || key.includes("perech")) buckets.transfer += amount;
    else if (key.includes("cash") || key.includes("naqd")) buckets.cash += amount;
  }
  return buckets;
}
