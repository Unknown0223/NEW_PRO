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

export function paymentAmountsNetMinusUnpaid(
  sprLabels: string[],
  netNorm: Map<string, Prisma.Decimal> | undefined,
  unpaidNorm: Map<string, Prisma.Decimal> | undefined
): ClientBalancePaymentTypeSummary[] {
  void unpaidNorm;
  const labels = extendSprLabelsWithDiscountSettlement(sprLabels);
  if (labels.length === 0) return [];
  const m = netNorm ?? new Map<string, Prisma.Decimal>();
  return labels.map((l) => {
    const nk = paymentLabelToNormKey(l);
    const amt = m.get(nk) ?? new Prisma.Decimal(0);
    return { label: l.trim(), amount: amt.toString() };
  });
}

export function buildSummaryNetMinusUnpaid(
  sprLabels: string[],
  netByExactType: Map<string, Prisma.Decimal>,
  unpaidGlobalNorm: Map<string, Prisma.Decimal>
): ClientBalancePaymentTypeSummary[] {
  void unpaidGlobalNorm;
  const labels = extendSprLabelsWithDiscountSettlement(sprLabels);
  if (labels.length === 0) return [];
  const netNorm = new Map<string, Prisma.Decimal>();
  for (const [k, v] of netByExactType) {
    const nk = paymentLabelToNormKey(k);
    const prev = netNorm.get(nk) ?? new Prisma.Decimal(0);
    netNorm.set(nk, prev.add(v));
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
