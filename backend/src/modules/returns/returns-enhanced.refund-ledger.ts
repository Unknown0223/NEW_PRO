import { Prisma, type PrismaClient } from "@prisma/client";
import { R } from "./returns-enhanced.helpers";

export const RETURN_REFUND_MOVEMENT_NOTE = "Возврат";

export function returnRefundNote(returnNumber?: string | null): string {
  const ref = returnNumber?.trim();
  return ref ? `${RETURN_REFUND_MOVEMENT_NOTE} · ${ref}` : RETURN_REFUND_MOVEMENT_NOTE;
}

export function isReturnRefundNote(note: string | null | undefined): boolean {
  const n = (note ?? "").trim();
  return (
    n === RETURN_REFUND_MOVEMENT_NOTE ||
    n.startsWith(`${RETURN_REFUND_MOVEMENT_NOTE} ·`) ||
    n.startsWith("Vazvrat:")
  );
}

/**
 * Polki/vazvrat refund: ClientBalance ↑ + ledger `client_payments` (entry_kind=refund).
 * Ledger UI `ledger_net_balance` faqat orders∪payments o‘qiydi — shu qatorsiz balans/tarix o‘zgarmaydi.
 */
export async function applyClientReturnRefund(
  tx: PrismaClient | Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  amount: number | string | Prisma.Decimal,
  uid: number | null,
  opts?: {
    returnNumber?: string | null;
    orderId?: number | null;
    ledgerAgentId?: number | null;
    paidAt?: Date;
    /** Agar true — faqat payment qatori (balans allaqachon yangilangan / backfill). */
    skipBalance?: boolean;
  }
): Promise<{ paymentId: number }> {
  const refund = R(amount);
  if (!refund.gt(0)) return { paymentId: 0 };

  const note = returnRefundNote(opts?.returnNumber);
  const eventAt = opts?.paidAt ?? new Date();

  const payment = await tx.payment.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      order_id: opts?.orderId ?? null,
      amount: refund,
      payment_type: "balance",
      note,
      created_by_user_id: uid,
      workflow_status: "confirmed",
      paid_at: eventAt,
      received_at: eventAt,
      confirmed_at: eventAt,
      entry_kind: "refund",
      ledger_agent_id: opts?.ledgerAgentId ?? null
    }
  });

  if (!opts?.skipBalance) {
    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      create: { tenant_id: tenantId, client_id: clientId, balance: refund },
      update: { balance: { increment: refund } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta: refund,
        note: opts?.returnNumber?.trim() ? `Vazvrat: ${opts.returnNumber.trim()}` : note,
        user_id: uid
      }
    });
  }

  return { paymentId: payment.id };
}
