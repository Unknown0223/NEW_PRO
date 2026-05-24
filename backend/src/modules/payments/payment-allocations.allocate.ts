import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import type { AllocationMode, PaymentAllocationRow } from "./payment-allocations.types";
import {
  assertTenantAccess,
  getAllocatedForOrder,
  getAllocatedForPayment,
  normalizeAllocationMode
} from "./payment-allocations.helpers";
import {
  getCandidateOrdersForAllocation,
  type AllocationCandidateOrder
} from "./payment-allocations.open";
/** FIFO allocation — must run inside caller's transaction when confirming payments. */
export async function allocatePaymentInTransaction(
  tx: Prisma.TransactionClient,
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  options?: {
    mode?: AllocationMode;
    agent_id?: number | null;
    order_ids?: number[];
  }
): Promise<PaymentAllocationRow[]> {
    // Fetch payment details
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, tenant_id: tenantId }
    });
    if (!payment) throw new Error("PAYMENT_NOT_FOUND");
    if (payment.deleted_at != null) {
      throw new Error("PAYMENT_VOIDED");
    }
    if (String(payment.entry_kind ?? "payment") === "client_expense") {
      throw new Error("NOT_ALLOCATABLE");
    }

    // Remaining payment amount after any previous allocations
    const alreadyAllocated = await getAllocatedForPayment(tx, tenantId, paymentId);
    let remaining = payment.amount.sub(alreadyAllocated);

    if (remaining.lte(0)) {
      // Nothing left to allocate
      return [];
    }

    const mode = normalizeAllocationMode(options?.mode);
    const agentId =
      options?.agent_id != null && Number.isFinite(options.agent_id) && options.agent_id > 0
        ? Number(options.agent_id)
        : (payment.ledger_agent_id ?? null);
    const explicitOrderIds = (options?.order_ids ?? []).filter((id) => Number.isFinite(id) && id > 0);
    if (explicitOrderIds.length === 0 && payment.order_id != null && payment.order_id > 0) {
      explicitOrderIds.push(payment.order_id);
    }

    const orders: AllocationCandidateOrder[] =
      explicitOrderIds.length > 0
        ? await getCandidateOrdersForAllocation(tx, tenantId, {
            client_id: payment.client_id,
            agent_id: agentId,
            mode,
            order_ids: explicitOrderIds
          })
        : mode === "none"
          ? [
              ...(await getCandidateOrdersForAllocation(tx, tenantId, {
                client_id: payment.client_id,
                agent_id: agentId,
                mode: "cash"
              })),
              ...(await getCandidateOrdersForAllocation(tx, tenantId, {
                client_id: payment.client_id,
                agent_id: agentId,
                mode: "consignment"
              }))
            ]
          : await getCandidateOrdersForAllocation(tx, tenantId, {
              client_id: payment.client_id,
              agent_id: agentId,
              mode
            });

    const uniqOrders: AllocationCandidateOrder[] = [];
    const seen = new Set<number>();
    for (const row of orders) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      uniqOrders.push(row);
    }

    const allocations: PaymentAllocationRow[] = [];

    const orderIds = uniqOrders.map((o) => o.id);
    const allocatedByOrder = new Map<number, Prisma.Decimal>();
    if (orderIds.length > 0) {
      const grouped = await tx.paymentAllocation.groupBy({
        by: ["order_id"],
        where: { tenant_id: tenantId, order_id: { in: orderIds } },
        _sum: { amount: true }
      });
      for (const row of grouped) {
        allocatedByOrder.set(row.order_id, row._sum.amount ?? new Prisma.Decimal(0));
      }
    }

    for (const order of uniqOrders) {
      if (remaining.lte(0)) break;

      const alreadyAllocatedToOrder = allocatedByOrder.get(order.id) ?? new Prisma.Decimal(0);
      const orderRemaining = order.total_sum.sub(alreadyAllocatedToOrder);

      if (orderRemaining.lte(0)) continue; // Fully paid

      const allocAmount = remaining.lt(orderRemaining) ? remaining : orderRemaining;

      // Create allocation record
      const allocation = await tx.paymentAllocation.create({
        data: {
          tenant_id: tenantId,
          payment_id: paymentId,
          order_id: order.id,
          amount: allocAmount
        }
      });

      allocations.push({
        id: allocation.id,
        payment_id: allocation.payment_id,
        order_id: allocation.order_id,
        order_number: order.number,
        amount: allocation.amount.toString(),
        created_at: allocation.created_at.toISOString()
      });

      remaining = remaining.sub(allocAmount);
    }

    // Audit log
    if (actorUserId && allocations.length > 0) {
      await appendTenantAuditEvent({
        tenantId,
        actorUserId,
        entityType: AuditEntityType.finance,
        entityId: String(paymentId),
        action: "payment.allocate",
        payload: {
          payment_id: paymentId,
          mode,
          agent_id: agentId,
          allocations_count: allocations.length,
          total_allocated: allocations
            .reduce((s, a) => s.add(new Prisma.Decimal(a.amount)), new Prisma.Decimal(0))
            .toString()
        }
      });
    }

    return allocations;
}

export async function allocatePayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  options?: {
    mode?: AllocationMode;
    agent_id?: number | null;
    order_ids?: number[];
  }
): Promise<PaymentAllocationRow[]> {
  await assertTenantAccess(tenantId);
  return prisma.$transaction((tx) =>
    allocatePaymentInTransaction(tx, tenantId, paymentId, actorUserId, options)
  );
}
