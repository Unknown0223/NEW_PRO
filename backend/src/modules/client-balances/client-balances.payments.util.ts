import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";
import {
  paymentTypesFromMethodEntries,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel,
  type PaymentMethodEntryDto
} from "../tenant-settings/finance-refs";

import {
  DISCOUNT_SETTLEMENT_PAYMENT_LABEL,
  DISCOUNT_SETTLEMENT_PAY_TYPE_KEY
} from "./client-balances.constants";
import type { ClientBalanceListQuery, ClientBalancePaymentTypeSummary } from "./client-balances.types";

export function extendSprLabelsWithDiscountSettlement(sprLabels: string[]): string[] {
  const has = sprLabels.some(
    (l) => normPayTypeKey(l) === normPayTypeKey(DISCOUNT_SETTLEMENT_PAYMENT_LABEL)
  );
  return has ? sprLabels : [...sprLabels, DISCOUNT_SETTLEMENT_PAYMENT_LABEL];
}

export function paymentLabelToNormKey(label: string): string {
  if (normPayTypeKey(label) === normPayTypeKey(DISCOUNT_SETTLEMENT_PAYMENT_LABEL)) {
    return normPayTypeKey(DISCOUNT_SETTLEMENT_PAY_TYPE_KEY);
  }
  return normPayTypeKey(label);
}

function toDecimal(v: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal {
  if (v == null) return new Prisma.Decimal(0);
  if (v instanceof Prisma.Decimal) return v;
  try {
    return new Prisma.Decimal(v);
  } catch {
    return new Prisma.Decimal(0);
  }
}

/**
 * Tip (to‘lov usuli) ustunlari — «Балансы клиентов» qoidasi:
 * - Общий ≤ 0 (qarz / nol): tip ustunlari 0; qarz faqat «Общий»da.
 * - Общий > 0 (предоплата): tip bo‘yicha `max(0, to‘lov − yopilmagan zakaz)`,
 *   yig‘indi Общий bilan moslashtiriladi (proporsional).
 */
export function paymentAmountsNetMinusUnpaid(
  sprLabels: string[],
  netNorm: Map<string, Prisma.Decimal> | undefined,
  unpaidNorm: Map<string, Prisma.Decimal> | undefined,
  overallBalance?: Prisma.Decimal | number | string | null
): ClientBalancePaymentTypeSummary[] {
  const labels = extendSprLabelsWithDiscountSettlement(sprLabels);
  if (labels.length === 0) return [];

  const bal = toDecimal(overallBalance);
  if (bal.lte(0)) {
    return labels.map((l) => ({ label: l.trim(), amount: "0" }));
  }

  const pay = netNorm ?? new Map<string, Prisma.Decimal>();
  const unpaid = unpaidNorm ?? new Map<string, Prisma.Decimal>();
  const raw: Prisma.Decimal[] = labels.map((l) => {
    const nk = paymentLabelToNormKey(l);
    const net = (pay.get(nk) ?? new Prisma.Decimal(0)).sub(unpaid.get(nk) ?? new Prisma.Decimal(0));
    return net.gt(0) ? net : new Prisma.Decimal(0);
  });

  let sumRaw = new Prisma.Decimal(0);
  for (const x of raw) sumRaw = sumRaw.add(x);

  if (sumRaw.lte(0)) {
    // Tip bo‘yicha surplus yo‘q — butun peredoplatani birinchi usulga qo‘yamiz.
    return labels.map((l, i) => ({
      label: l.trim(),
      amount: i === 0 ? bal.toFixed(2) : "0"
    }));
  }

  // Proporsional: tip yig‘indisi = Общий (peredoplata).
  const scaled = raw.map((x) => x.mul(bal).div(sumRaw));
  let allocated = new Prisma.Decimal(0);
  const out: ClientBalancePaymentTypeSummary[] = [];
  for (let i = 0; i < labels.length; i++) {
    const isLast = i === labels.length - 1;
    const amt = isLast ? bal.sub(allocated) : scaled[i]!.toDecimalPlaces(2);
    if (!isLast) allocated = allocated.add(amt);
    out.push({ label: labels[i]!.trim(), amount: amt.toFixed(2) });
  }
  return out;
}

/** Filtrlangan mijozlar tip ustunlarining yig‘indisi (har bir kartochka = o‘z ustuni). */
export function buildSummaryOverpaymentsByType(
  sprLabels: string[],
  clients: Array<{
    balance: Prisma.Decimal | number | string;
    payNorm?: Map<string, Prisma.Decimal>;
    unpaidNorm?: Map<string, Prisma.Decimal>;
  }>
): ClientBalancePaymentTypeSummary[] {
  const labels = extendSprLabelsWithDiscountSettlement(sprLabels);
  if (labels.length === 0) return [];
  const sums = new Map<string, Prisma.Decimal>();
  for (const l of labels) sums.set(paymentLabelToNormKey(l), new Prisma.Decimal(0));

  for (const c of clients) {
    const amounts = paymentAmountsNetMinusUnpaid(sprLabels, c.payNorm, c.unpaidNorm, c.balance);
    for (const a of amounts) {
      const nk = paymentLabelToNormKey(a.label);
      sums.set(nk, (sums.get(nk) ?? new Prisma.Decimal(0)).add(toDecimal(a.amount)));
    }
  }

  return labels.map((l) => ({
    label: l.trim(),
    amount: (sums.get(paymentLabelToNormKey(l)) ?? new Prisma.Decimal(0)).toFixed(2)
  }));
}

/** @deprecated — use buildSummaryOverpaymentsByType (qarz/peredoplata qoidasi). */
export function buildSummaryNetMinusUnpaid(
  sprLabels: string[],
  netByExactType: Map<string, Prisma.Decimal>,
  unpaidGlobalNorm: Map<string, Prisma.Decimal>,
  /** Agar berilsa — faqat peredoplata (Общий>0) qoidasi bilan; aks holda xom to‘lov yig‘indisi. */
  overallBalanceHint?: Prisma.Decimal | number | string | null
): ClientBalancePaymentTypeSummary[] {
  if (overallBalanceHint !== undefined) {
    return paymentAmountsNetMinusUnpaid(
      sprLabels,
      (() => {
        const m = new Map<string, Prisma.Decimal>();
        for (const [k, v] of netByExactType) {
          const nk = paymentLabelToNormKey(k);
          m.set(nk, (m.get(nk) ?? new Prisma.Decimal(0)).add(v));
        }
        return m;
      })(),
      unpaidGlobalNorm,
      overallBalanceHint
    );
  }
  // Legacy fallback (konsignatsiya KPI va h.k.) — xom net, qoida yo‘q.
  const labels = extendSprLabelsWithDiscountSettlement(sprLabels);
  if (labels.length === 0) return [];
  const netNorm = new Map<string, Prisma.Decimal>();
  for (const [k, v] of netByExactType) {
    const nk = paymentLabelToNormKey(k);
    netNorm.set(nk, (netNorm.get(nk) ?? new Prisma.Decimal(0)).add(v));
  }
  return labels.map((l) => {
    const nk = paymentLabelToNormKey(l);
    const amt = netNorm.get(nk) ?? new Prisma.Decimal(0);
    return { label: l.trim(), amount: amt.toString() };
  });
}

/** «По доставке»: bitta zakaz — qarzni faqat zakazning to‘lov usuli ustunida (manfiy). */
export function paymentAmountsForOrderDebtByMethod(
  sprLabels: string[],
  entries: PaymentMethodEntryDto[],
  paymentRefRaw: string | null | undefined,
  orderUnpaid: Prisma.Decimal
): ClientBalancePaymentTypeSummary[] {
  void sprLabels;
  void entries;
  void paymentRefRaw;
  void orderUnpaid;
  return [];
}

export function normPayTypeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function mapPaymentTypeKeyForAggregation(
  entryKind: string | null | undefined,
  paymentType: string | null | undefined,
  entries: PaymentMethodEntryDto[]
): string {
  if (String(entryKind ?? "") === "discount_settlement") {
    return normPayTypeKey(DISCOUNT_SETTLEMENT_PAY_TYPE_KEY);
  }
  const resolved =
    resolvePaymentMethodRefToLabel(paymentType ?? "", entries) ?? (paymentType ?? "").trim();
  return normPayTypeKey(resolved);
}

export function readSortDir(q: ClientBalanceListQuery): 1 | -1 {
  return q.sort_dir === "desc" ? -1 : 1;
}

export function moneySortValueFromPaymentAmounts(
  amounts: ClientBalancePaymentTypeSummary[] | undefined,
  sortBy: string,
  sprLabels: string[]
): number {
  if (!sortBy.startsWith("pay:")) return 0;
  if (!amounts || amounts.length === 0) return 0;
  const wanted = normPayTypeKey(sortBy.slice(4));
  const labels = extendSprLabelsWithDiscountSettlement(sprLabels);
  const idxByLabel = labels.findIndex((x) => normPayTypeKey(x) === wanted);
  if (idxByLabel >= 0 && idxByLabel < amounts.length) {
    const v = Number(amounts[idxByLabel]?.amount ?? "0");
    return Number.isFinite(v) ? v : 0;
  }
  const hit = amounts.find((x) => normPayTypeKey(x.label) === wanted);
  const v = Number(hit?.amount ?? "0");
  return Number.isFinite(v) ? v : 0;
}

export function compareNumForSort(a: number, b: number, dir: 1 | -1): number {
  return (a - b) * dir;
}

/**
 * `$queryRaw` / `pg` ba'zan INTEGER ustunini `bigint` qaytaradi; `Map<number, …>` kaliti bilan
 * Prisma `c.id` (`number`) mos kelmasa — qator bo‘yicha yig‘indilar yo‘qoladi, svodka esa global mapda qoladi.
 */
export function sqlIntIdToNumber(raw: unknown): number {
  if (raw == null) return NaN;
  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "number") return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}
