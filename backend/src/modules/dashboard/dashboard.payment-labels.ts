import { Prisma } from "@prisma/client";
import {
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";
import { clampPct } from "./dashboard.helpers";

/** DB dagi payment_type / payment_method_ref → UI nomi; bir xil nomlarni birlashtiradi. */
export function aggregatePaymentsByDisplayLabel(
  rows: Array<{ payment_type: string | null; amount: Prisma.Decimal }>,
  entries: PaymentMethodEntryDto[]
): Array<{ payment_type: string; amount: string; share_pct: number }> {
  const byLabel = new Map<string, Prisma.Decimal>();
  for (const r of rows) {
    const raw = (r.payment_type ?? "").trim();
    const label = !raw ? "—" : (resolvePaymentMethodRefToLabel(raw, entries) ?? raw);
    byLabel.set(label, (byLabel.get(label) ?? new Prisma.Decimal(0)).add(r.amount));
  }
  const grand = [...byLabel.values()].reduce((a, b) => a.add(b), new Prisma.Decimal(0));
  return [...byLabel.entries()]
    .sort((a, b) => b[1].comparedTo(a[1]))
    .map(([payment_type, amount]) => ({
      payment_type,
      amount: amount.toString(),
      share_pct: grand.gt(0) ? clampPct(amount.div(grand).mul(100).toNumber()) : 0
    }));
}
