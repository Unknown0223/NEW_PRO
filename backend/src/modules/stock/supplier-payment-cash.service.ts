import { Decimal } from "@prisma/client/runtime/library";
import type { Prisma } from "@prisma/client";

type PaymentDb = Pick<Prisma.TransactionClient, "payment" | "supplierPayment">;

/**
 * Kassadagi naqd modeli: mijoz kirimlari − mijoz rasxodi − ta'minotchiga to'lovlar (stornosiz).
 */
export async function getCashDeskAvailableCash(
  db: PaymentDb,
  tenantId: number,
  cashDeskId: number
): Promise<Decimal> {
  const [inflow, expenseOut, supplierOut] = await Promise.all([
    db.payment.aggregate({
      where: {
        tenant_id: tenantId,
        cash_desk_id: cashDeskId,
        deleted_at: null,
        workflow_status: "confirmed",
        entry_kind: "payment"
      },
      _sum: { amount: true }
    }),
    db.payment.aggregate({
      where: {
        tenant_id: tenantId,
        cash_desk_id: cashDeskId,
        deleted_at: null,
        workflow_status: "confirmed",
        entry_kind: "client_expense"
      },
      _sum: { amount: true }
    }),
    db.supplierPayment.aggregate({
      where: {
        tenant_id: tenantId,
        cash_desk_id: cashDeskId,
        reversed_at: null
      },
      _sum: { amount: true }
    })
  ]);
  const a = inflow._sum?.amount ?? new Decimal(0);
  const b = expenseOut._sum?.amount ?? new Decimal(0);
  const c = supplierOut._sum?.amount ?? new Decimal(0);
  return a.sub(b).sub(c);
}
