import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

/** Bo‘sh → null (create dan keyin String(id)); aks holda trim. */
export function resolvePaymentDocNumber(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\u00a0/g, " ");
  if (!s) return null;
  return s.slice(0, 64);
}

export async function finalizePaymentNumber(
  tx: Prisma.TransactionClient,
  paymentId: number,
  requested: string | null
): Promise<void> {
  const number = requested ?? String(paymentId);
  await tx.payment.update({
    where: { id: paymentId },
    data: { number }
  });
}

export async function assertCashDeskAcceptsPurpose(
  tenantId: number,
  cashDeskId: number,
  purpose: "client_payment" | "discount_payment"
): Promise<void> {
  const desk = await prisma.cashDesk.findFirst({
    where: { id: cashDeskId, tenant_id: tenantId, is_active: true },
    select: { accepts_client_payments: true, accepts_discount_payments: true }
  });
  if (!desk) throw new Error("BAD_CASH_DESK");
  if (purpose === "client_payment" && !desk.accepts_client_payments) {
    throw new Error("CASH_DESK_NO_CLIENT_PAYMENTS");
  }
  if (purpose === "discount_payment" && !desk.accepts_discount_payments) {
    throw new Error("CASH_DESK_NO_DISCOUNT_PAYMENTS");
  }
}
