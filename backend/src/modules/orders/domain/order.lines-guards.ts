/**
 * Domain: Orders — tahrirlashda kredit / to‘lov taqsimoti tekshiruvlari.
 */
import { Prisma } from "@prisma/client";
import { ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE } from "../order-status";

export async function assertOrderLinesCreditAndPayments(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: number;
    orderId: number;
    clientId: number;
    creditLimit: Prisma.Decimal;
    paidTotal: Prisma.Decimal;
  }
): Promise<void> {
  const { tenantId, orderId, clientId, creditLimit, paidTotal } = params;

  if (creditLimit.gt(0)) {
    const balRow = await tx.clientBalance.findUnique({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: clientId } },
      select: { balance: true }
    });
    const accountBalance = balRow?.balance ?? new Prisma.Decimal(0);
    const headroom = creditLimit.add(accountBalance);
    const agg = await tx.order.aggregate({
      where: {
        tenant_id: tenantId,
        client_id: clientId,
        id: { not: orderId },
        status: { notIn: [...ORDER_STATUSES_EXCLUDED_FROM_CREDIT_EXPOSURE] }
      },
      _sum: { total_sum: true }
    });
    const outstanding = agg._sum.total_sum ?? new Prisma.Decimal(0);
    const projected = outstanding.add(paidTotal);
    if (projected.gt(headroom)) {
      const err = new Error("CREDIT_LIMIT_EXCEEDED") as Error & {
        credit_limit: string;
        outstanding: string;
        order_total: string;
      };
      err.credit_limit = headroom.toString();
      err.outstanding = outstanding.toString();
      err.order_total = paidTotal.toString();
      throw err;
    }
  }

  // Касса / оплаты: сумма заказа не может стать меньше уже распределённых платежей.
  const allocRows = await tx.$queryRaw<Array<{ alloc: Prisma.Decimal }>>`
    SELECT COALESCE(SUM(amount), 0)::decimal(15,2) AS alloc
    FROM payment_allocations
    WHERE tenant_id = ${tenantId}
      AND order_id = ${orderId}
  `;
  const allocated = allocRows[0]?.alloc ?? new Prisma.Decimal(0);
  if (allocated.gt(paidTotal)) {
    const err = new Error("ORDER_TOTAL_BELOW_ALLOCATED") as Error & {
      allocated: string;
      order_total: string;
    };
    err.allocated = allocated.toString();
    err.order_total = paidTotal.toString();
    throw err;
  }
}
