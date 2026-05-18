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

import type { ClientBalanceListQuery, ClientBalancePaymentTypeSummary } from "./client-balances.types";

export function paymentAmountsNetMinusUnpaid(
  sprLabels: string[],
  netNorm: Map<string, Prisma.Decimal> | undefined,
  unpaidNorm: Map<string, Prisma.Decimal> | undefined
): ClientBalancePaymentTypeSummary[] {
  void sprLabels;
  void netNorm;
  void unpaidNorm;
  // Yangi logika: qarzdorlik/payment-method kesimi bekor qilindi, faqat umumiy balans ishlatiladi.
  return [];
}

export function buildSummaryNetMinusUnpaid(
  sprLabels: string[],
  netByExactType: Map<string, Prisma.Decimal>,
  unpaidGlobalNorm: Map<string, Prisma.Decimal>
): ClientBalancePaymentTypeSummary[] {
  void sprLabels;
  void netByExactType;
  void unpaidGlobalNorm;
  return [];
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
  const idxByLabel = sprLabels.findIndex((x) => normPayTypeKey(x) === wanted);
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

