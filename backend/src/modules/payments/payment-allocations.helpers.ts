import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { AllocationMode } from "./payment-allocations.types";

export function normalizeAllocationMode(raw: AllocationMode | undefined): AllocationMode {
  return raw === "cash" || raw === "consignment" ? raw : "none";
}

export function dueSortTime(order: {
  consignment_due_date?: Date | null;
  created_at?: Date | null;
}): number {
  return (order.consignment_due_date ?? order.created_at ?? new Date(0)).getTime();
}

export async function assertTenantAccess(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.is_active) {
    throw new Error("TENANT_NOT_FOUND");
  }
  return tenant;
}

// Compute total already allocated for an order from payment_allocations
export async function getAllocatedForOrder(
  tx: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  orderId: number
): Promise<Prisma.Decimal> {
  const result = await (tx as typeof prisma).paymentAllocation.aggregate({
    _sum: { amount: true },
    where: { tenant_id: tenantId, order_id: orderId }
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}

// Compute total already allocated from a payment
export async function getAllocatedForPayment(
  tx: Prisma.TransactionClient | typeof prisma,
  tenantId: number,
  paymentId: number
): Promise<Prisma.Decimal> {
  const result = await (tx as typeof prisma).paymentAllocation.aggregate({
    _sum: { amount: true },
    where: { tenant_id: tenantId, payment_id: paymentId }
  });
  return result._sum.amount ?? new Prisma.Decimal(0);
}
