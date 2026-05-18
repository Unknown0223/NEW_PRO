import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { PaymentAllocationRow } from "./payment-allocations.types";
import { assertTenantAccess } from "./payment-allocations.helpers";

export async function getPaymentAllocations(
  tenantId: number,
  paymentId: number
): Promise<PaymentAllocationRow[]> {
  await assertTenantAccess(tenantId);

  const allocations = await prisma.paymentAllocation.findMany({
    where: {
      tenant_id: tenantId,
      payment_id: paymentId
    },
    orderBy: { order_id: "asc" }
  });

  // Resolve order numbers
  const orderIds = allocations.map((a) => a.order_id);
  const orders = orderIds.length > 0
    ? await prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, number: true } })
    : [];
  const orderMap = new Map(orders.map((o) => [o.id, o.number]));

  return allocations.map((a) => ({
    id: a.id,
    payment_id: a.payment_id,
    order_id: a.order_id,
    order_number: orderMap.get(a.order_id) ?? `#${a.order_id}`,
    amount: a.amount.toString(),
    created_at: a.created_at.toISOString()
  }));
}
