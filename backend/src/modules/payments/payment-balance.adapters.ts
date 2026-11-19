/**
 * Payment balance adapters (ADR-005 yuqori qavat).
 * Sign / pending skip shu yerda; yozuv `applyDelta` orqali.
 */
import { Prisma } from "@prisma/client";
import type { DbTransaction } from "../../lib/db-context";
import {
  applyDelta,
  type ApplyDeltaResult
} from "../client-balances/client-balance-mutator";

export type PaymentBalanceFields = {
  id: number;
  client_id: number;
  amount: Prisma.Decimal;
  entry_kind?: string | null;
  workflow_status?: string | null;
};

export function isNeverPostedWorkflow(workflowStatus: string | null | undefined): boolean {
  const wf = String(workflowStatus ?? "");
  return wf === "pending_confirmation" || wf === "rejected";
}

export function isClientExpense(entryKind: string | null | undefined): boolean {
  return String(entryKind ?? "payment") === "client_expense";
}

/** Confirmed payment / discount_settlement: +amount. `client_expense` → null. */
export function deltaForPostConfirmedPayment(
  entryKind: string | null | undefined,
  amount: Prisma.Decimal
): Prisma.Decimal | null {
  if (isClientExpense(entryKind)) return null;
  return amount;
}

/** Client expense post: −amount. */
export function deltaForPostExpense(amount: Prisma.Decimal): Prisma.Decimal {
  return amount.neg();
}

/**
 * Void / return reverse. Pending/rejected → null (balans hech qachon post bo‘lmagan).
 * Expense reverse: +amount; payment/discount: −amount.
 */
export function deltaForReversePayment(
  entryKind: string | null | undefined,
  workflowStatus: string | null | undefined,
  amount: Prisma.Decimal
): Prisma.Decimal | null {
  if (isNeverPostedWorkflow(workflowStatus)) return null;
  if (isClientExpense(entryKind)) return amount;
  return amount.neg();
}

/** Summa tahriri: payment → next−old; expense → old−next. Teng bo‘lsa null. */
export function deltaForPaymentAmountEdit(
  entryKind: string | null | undefined,
  oldAmount: Prisma.Decimal,
  nextAmount: Prisma.Decimal
): Prisma.Decimal | null {
  if (oldAmount.equals(nextAmount)) return null;
  if (isClientExpense(entryKind)) return oldAmount.sub(nextAmount);
  return nextAmount.sub(oldAmount);
}

export async function postConfirmedPaymentAmount(
  tx: DbTransaction,
  args: {
    tenantId: number;
    payment: PaymentBalanceFields;
    note?: string | null;
    userId?: number | null;
  }
): Promise<ApplyDeltaResult> {
  const delta = deltaForPostConfirmedPayment(args.payment.entry_kind, args.payment.amount);
  if (delta == null) throw new Error("BAD_ENTRY_KIND");
  return applyDelta(tx, {
    tenantId: args.tenantId,
    clientId: args.payment.client_id,
    delta,
    note: args.note,
    userId: args.userId
  });
}

export async function postExpense(
  tx: DbTransaction,
  args: {
    tenantId: number;
    payment: PaymentBalanceFields;
    note?: string | null;
    userId?: number | null;
  }
): Promise<ApplyDeltaResult> {
  if (!isClientExpense(args.payment.entry_kind)) throw new Error("BAD_ENTRY_KIND");
  return applyDelta(tx, {
    tenantId: args.tenantId,
    clientId: args.payment.client_id,
    delta: deltaForPostExpense(args.payment.amount),
    note: args.note,
    userId: args.userId
  });
}

/** Pending/rejected da null (skip); aks holda reverse delta + applyDelta. */
export async function reversePayment(
  tx: DbTransaction,
  args: {
    tenantId: number;
    payment: PaymentBalanceFields;
    note?: string | null;
    userId?: number | null;
  }
): Promise<ApplyDeltaResult | null> {
  const delta = deltaForReversePayment(
    args.payment.entry_kind,
    args.payment.workflow_status,
    args.payment.amount
  );
  if (delta == null) return null;
  return applyDelta(tx, {
    tenantId: args.tenantId,
    clientId: args.payment.client_id,
    delta,
    note: args.note,
    userId: args.userId
  });
}
