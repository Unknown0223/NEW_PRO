/**
 * Domain: Payments (kirim/chiqim, allocatsiya, batch).
 * Boundary: route → Zod + RBAC; servis → tranzaksiya, client audit, dashboard invalidatsiya.
 * Bog‘liq: `payments.route.ts`, `contracts/payments.schemas.ts`, `docs/domain-boundary.md`.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendClientAuditLog } from "../clients/clients.service";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import { invalidateDashboard } from "../../lib/redis-cache";
import {
  allocatePayment,
  getPaymentAllocations,
  type AllocationMode,
  type PaymentAllocationRow
} from "./payment-allocations.service";
import type { PaymentDetailPayload, UpdatePaymentInput } from "./payment.query.types";
import { getPaymentDetail, resolveLedgerAgentId } from "./payment.query.read";
import { paymentListInclude } from "./payment.query.mappers";

export async function updatePayment(
  tenantId: number,
  paymentId: number,
  input: UpdatePaymentInput,
  actorUserId: number | null
): Promise<PaymentDetailPayload> {
  const patched =
    input.amount !== undefined ||
    input.payment_type !== undefined ||
    input.note !== undefined ||
    input.cash_desk_id !== undefined ||
    input.paid_at !== undefined ||
    input.order_id !== undefined ||
    input.expeditor_user_id !== undefined ||
    input.ledger_agent_id !== undefined;
  if (!patched) throw new Error("EMPTY_PATCH");

  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { id: paymentId, tenant_id: tenantId },
      include: paymentListInclude(tenantId)
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.deleted_at != null) throw new Error("PAYMENT_VOIDED");

    const allocAgg = await tx.paymentAllocation.aggregate({
      where: { tenant_id: tenantId, payment_id: paymentId },
      _sum: { amount: true }
    });
    const allocatedSum = allocAgg._sum.amount ?? new Prisma.Decimal(0);

    const ek = String(existing.entry_kind ?? "payment");
    const oldAmount = existing.amount;

    let nextAmount = oldAmount;
    if (input.amount !== undefined) {
      if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("BAD_AMOUNT");
      nextAmount = new Prisma.Decimal(input.amount);
      if (nextAmount.lt(allocatedSum)) throw new Error("AMOUNT_BELOW_ALLOCATED");
    }

    let nextOrderId = existing.order_id;
    if (input.order_id !== undefined) {
      let requestedOrderId: number | null;
      if (input.order_id == null || input.order_id < 1) {
        requestedOrderId = null;
      } else {
        const ord = await tx.order.findFirst({
          where: { id: input.order_id, tenant_id: tenantId, client_id: existing.client_id }
        });
        if (!ord) throw new Error("BAD_ORDER");
        requestedOrderId = input.order_id;
      }

      const allocCount = await tx.paymentAllocation.count({
        where: { tenant_id: tenantId, payment_id: paymentId }
      });
      const prevOid = existing.order_id != null && existing.order_id > 0 ? existing.order_id : null;
      const orderUnchanged =
        (prevOid === null && requestedOrderId === null) ||
        (prevOid != null && requestedOrderId != null && prevOid === requestedOrderId);
      if (allocCount > 0 && !orderUnchanged) {
        throw new Error("ORDER_LOCKED_BY_ALLOCATIONS");
      }

      nextOrderId = requestedOrderId;
    }

    let deskPatch: number | null | undefined;
    if (input.cash_desk_id !== undefined) {
      if (input.cash_desk_id == null || input.cash_desk_id < 1) deskPatch = null;
      else {
        const desk = await tx.cashDesk.findFirst({
          where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true }
        });
        if (!desk) throw new Error("BAD_CASH_DESK");
        deskPatch = desk.id;
      }
    }

    let paidAtPatch: Date | null | undefined;
    if (input.paid_at !== undefined) {
      if (input.paid_at == null || !String(input.paid_at).trim()) paidAtPatch = null;
      else {
        const parsed = new Date(String(input.paid_at).trim());
        if (Number.isNaN(parsed.getTime())) throw new Error("BAD_PAID_AT");
        paidAtPatch = parsed;
      }
    }

    const orderForExpeditorCheck = input.order_id !== undefined ? nextOrderId : existing.order_id;
    let expeditorPatch: number | null | undefined;
    if (input.expeditor_user_id !== undefined) {
      if (orderForExpeditorCheck != null) throw new Error("BAD_EXPEDITOR_SCOPE");
      if (input.expeditor_user_id == null || input.expeditor_user_id < 1) expeditorPatch = null;
      else {
        const ex = await tx.user.findFirst({
          where: { id: input.expeditor_user_id, tenant_id: tenantId, is_active: true }
        });
        if (!ex) throw new Error("BAD_EXPEDITOR");
        expeditorPatch = ex.id;
      }
    }

    if (!oldAmount.equals(nextAmount)) {
      const bal = await tx.clientBalance.findUnique({
        where: { tenant_id_client_id: { tenant_id: tenantId, client_id: existing.client_id } }
      });
      if (bal) {
        const isExpense = ek === "client_expense";
        const movementDelta = isExpense ? oldAmount.sub(nextAmount) : nextAmount.sub(oldAmount);
        await tx.clientBalance.update({
          where: { id: bal.id },
          data: { balance: { increment: movementDelta } }
        });
        const kindLabel = isExpense ? "Rasxod" : "To‘lov";
        await tx.clientBalanceMovement.create({
          data: {
            client_balance_id: bal.id,
            delta: movementDelta,
            note: `${kindLabel} #${paymentId} tahrir (summa)`,
            user_id: uid
          }
        });
      }
    }

    const data: Prisma.PaymentUncheckedUpdateInput = {};
    if (input.amount !== undefined) data.amount = nextAmount;
    if (input.payment_type !== undefined) {
      const pt = input.payment_type.trim();
      if (!pt) throw new Error("BAD_PAYMENT_TYPE");
      data.payment_type = pt.slice(0, 64);
    }
    if (input.note !== undefined) {
      data.note = input.note === null ? null : String(input.note).trim() ? String(input.note).trim() : null;
    }
    if (deskPatch !== undefined) data.cash_desk_id = deskPatch;
    if (paidAtPatch !== undefined) {
      data.paid_at = paidAtPatch;
      data.received_at = paidAtPatch;
      data.confirmed_at = paidAtPatch;
    }
    if (input.order_id !== undefined) {
      const prevNorm = existing.order_id != null && existing.order_id > 0 ? existing.order_id : null;
      const nextNorm = nextOrderId != null && nextOrderId > 0 ? nextOrderId : null;
      if (prevNorm !== nextNorm) {
        data.order_id = nextOrderId;
        if (nextNorm != null) data.expeditor_user_id = null;
      }
    }
    if (expeditorPatch !== undefined && !(input.order_id !== undefined && nextOrderId != null)) {
      data.expeditor_user_id = expeditorPatch;
    }

    if (input.ledger_agent_id !== undefined) {
      if (input.ledger_agent_id == null || input.ledger_agent_id < 1) {
        data.ledger_agent_id = null;
      } else {
        const la = await resolveLedgerAgentId(tenantId, input.ledger_agent_id, tx);
        data.ledger_agent_id = la;
      }
    }

    await tx.payment.update({
      where: { id: paymentId },
      data
    });
  });

  void invalidateDashboard(tenantId);

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "payment.update",
      payload: { payment_id: paymentId, patch: { ...input } }
    });
  }

  const detail = await getPaymentDetail(tenantId, paymentId);
  if (!detail) throw new Error("NOT_FOUND");
  return detail;
}
