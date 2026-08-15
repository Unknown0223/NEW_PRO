import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";

import type { AllocationMode, PaymentAllocationRow } from "./payment-allocations.types";
import {
  assertTenantAccess,
  getAllocatedForPayment,
  normalizeAllocationMode
} from "./payment-allocations.helpers";
import {
  getCandidateOrdersForAllocation,
  sortCandidatesLegacyFirst,
  type AllocationCandidateOrder
} from "./payment-allocations.open";
import { maybeArchiveAgentsIfDebtCleared } from "../work-slots/work-slots.archive-agent";

export type AllocatePaymentOptions = {
  mode?: AllocationMode;
  agent_id?: number | null;
  order_ids?: number[];
  /** legacy buyurtmalar birinchi (dastavchik/kassa client-level). Explicit order_ids bo‘lsa e’tiborsiz. */
  priority?: "default" | "legacy_first";
  /** legacy_first uchun joriy agent (odatda clients.agent_id). */
  current_agent_id?: number | null;
};

/** FIFO allocation — must run inside caller's transaction when confirming payments. */
export async function allocatePaymentInTransaction(
  tx: Prisma.TransactionClient,
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  options?: AllocatePaymentOptions
): Promise<PaymentAllocationRow[]> {
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

  const alreadyAllocated = await getAllocatedForPayment(tx, tenantId, paymentId);
  let remaining = payment.amount.sub(alreadyAllocated);

  if (remaining.lte(0)) {
    return [];
  }

  const mode = normalizeAllocationMode(options?.mode);
  const explicitOrderIds = (options?.order_ids ?? []).filter((id) => Number.isFinite(id) && id > 0);
  if (explicitOrderIds.length === 0 && payment.order_id != null && payment.order_id > 0) {
    explicitOrderIds.push(payment.order_id);
  }

  const useLegacyFirst =
    options?.priority === "legacy_first" && explicitOrderIds.length === 0;

  // legacy_first: agent filter yo‘q (barcha agentlar buyurtmalari); aks holda options/ledger.
  const agentId = useLegacyFirst
    ? null
    : options?.agent_id != null && Number.isFinite(options.agent_id) && options.agent_id > 0
      ? Number(options.agent_id)
      : (payment.ledger_agent_id ?? null);

  let currentAgentId =
    options?.current_agent_id != null &&
    Number.isFinite(options.current_agent_id) &&
    options.current_agent_id > 0
      ? Number(options.current_agent_id)
      : null;
  if (useLegacyFirst && currentAgentId == null) {
    const client = await tx.client.findFirst({
      where: { id: payment.client_id, tenant_id: tenantId },
      select: { agent_id: true }
    });
    currentAgentId = client?.agent_id ?? payment.ledger_agent_id ?? null;
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

  const ordered = useLegacyFirst
    ? sortCandidatesLegacyFirst(uniqOrders, currentAgentId)
    : uniqOrders;

  const allocations: PaymentAllocationRow[] = [];
  const touchedAgentIds = new Set<number>();

  const orderIds = ordered.map((o) => o.id);
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

  for (const order of ordered) {
    if (remaining.lte(0)) break;

    const alreadyAllocatedToOrder = allocatedByOrder.get(order.id) ?? new Prisma.Decimal(0);
    const orderRemaining = order.merchandise_net.sub(alreadyAllocatedToOrder);

    if (orderRemaining.lte(0)) continue;

    const allocAmount = remaining.lt(orderRemaining) ? remaining : orderRemaining;

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

    if (order.agent_id != null && order.agent_id > 0) {
      touchedAgentIds.add(order.agent_id);
    }

    remaining = remaining.sub(allocAmount);
  }

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
        priority: useLegacyFirst ? "legacy_first" : "default",
        current_agent_id: currentAgentId,
        allocations_count: allocations.length,
        total_allocated: allocations
          .reduce((s, a) => s.add(new Prisma.Decimal(a.amount)), new Prisma.Decimal(0))
          .toString()
      }
    });
  }

  if (touchedAgentIds.size > 0) {
    await maybeArchiveAgentsIfDebtCleared(
      tenantId,
      [...touchedAgentIds],
      actorUserId,
      tx
    );
  }

  return allocations;
}

export async function allocatePayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  options?: AllocatePaymentOptions
): Promise<PaymentAllocationRow[]> {
  await assertTenantAccess(tenantId);
  return prisma.$transaction((tx) =>
    allocatePaymentInTransaction(tx, tenantId, paymentId, actorUserId, options)
  );
}
