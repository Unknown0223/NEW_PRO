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

import type { CreatePaymentInput, PaymentListRow } from "./payment.query";
import {
  getPaymentDetail,
  mapPaymentToListRow,
  paymentListInclude,
  resolveLedgerAgentId
} from "./payment.query";

export async function createClientExpense(
  tenantId: number,
  input: CreatePaymentInput,
  actorUserId: number | null
): Promise<PaymentListRow> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("BAD_AMOUNT");
  }
  const pt = input.payment_type.trim();
  if (!pt) throw new Error("BAD_PAYMENT_TYPE");

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  let cashDeskId: number | null = null;
  if (input.cash_desk_id != null && input.cash_desk_id > 0) {
    const desk = await prisma.cashDesk.findFirst({
      where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
    cashDeskId = desk.id;
  }

  let expeditorId: number | null = null;
  if (input.expeditor_user_id != null && input.expeditor_user_id > 0) {
    const ex = await prisma.user.findFirst({
      where: { id: input.expeditor_user_id, tenant_id: tenantId, is_active: true }
    });
    if (!ex) throw new Error("BAD_EXPEDITOR");
    expeditorId = ex.id;
  }

  const ledgerAgentId = await resolveLedgerAgentId(tenantId, input.ledger_agent_id);

  const { assertFieldStaffBranchScopeForActor } = await import("../work-slots/work-slots.branch-scope");
  await assertFieldStaffBranchScopeForActor(tenantId, actorUserId, [
    client.agent_id,
    ledgerAgentId,
    input.expeditor_user_id
  ]);

  const amountDec = new Prisma.Decimal(input.amount);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let eventAt = new Date();
  if (input.paid_at != null && String(input.paid_at).trim()) {
    const parsed = new Date(String(input.paid_at).trim());
    if (!Number.isNaN(parsed.getTime())) {
      eventAt = parsed;
    }
  }

  const neg = amountDec.neg();

  const row = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: input.client_id,
        order_id: null,
        amount: amountDec,
        payment_type: pt,
        note: input.note?.trim() || null,
        created_by_user_id: uid,
        cash_desk_id: cashDeskId,
        workflow_status: "confirmed",
        paid_at: eventAt,
        received_at: eventAt,
        confirmed_at: eventAt,
        entry_kind: "client_expense",
        expeditor_user_id: expeditorId,
        ledger_agent_id: ledgerAgentId
      }
    });

    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: input.client_id } },
      create: { tenant_id: tenantId, client_id: input.client_id, balance: neg },
      update: { balance: { decrement: amountDec } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta: neg,
        note: `Rasxod klient #${p.id}`,
        user_id: uid
      }
    });

    return tx.payment.findFirstOrThrow({
      where: { id: p.id },
      include: paymentListInclude(tenantId)
    });
  });

  await appendClientAuditLog(tenantId, input.client_id, actorUserId, "client.client_expense", {
    payment_id: row.id,
    amount: input.amount,
    payment_type: pt
  });

  void invalidateDashboard(tenantId);

  return mapPaymentToListRow(row, tenantId);
}

export async function createPayment(
  tenantId: number,
  input: CreatePaymentInput,
  actorUserId: number | null
): Promise<PaymentListRow> {
  const kind = input.entry_kind ?? "payment";
  if (kind === "client_expense") {
    return createClientExpense(tenantId, input, actorUserId);
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("BAD_AMOUNT");
  }
  const pt = input.payment_type.trim();
  if (!pt) throw new Error("BAD_PAYMENT_TYPE");

  const client = await prisma.client.findFirst({
    where: { id: input.client_id, tenant_id: tenantId, merged_into_client_id: null }
  });
  if (!client) throw new Error("BAD_CLIENT");

  if (input.order_id != null && input.order_id > 0) {
    const ord = await prisma.order.findFirst({
      where: { id: input.order_id, tenant_id: tenantId, client_id: input.client_id }
    });
    if (!ord) throw new Error("BAD_ORDER");
  }

  let cashDeskId: number | null = null;
  if (input.cash_desk_id != null && input.cash_desk_id > 0) {
    const desk = await prisma.cashDesk.findFirst({
      where: { id: input.cash_desk_id, tenant_id: tenantId, is_active: true }
    });
    if (!desk) throw new Error("BAD_CASH_DESK");
    cashDeskId = desk.id;
  }

  const amountDec = new Prisma.Decimal(input.amount);
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  let eventAt = new Date();
  if (input.paid_at != null && String(input.paid_at).trim()) {
    const parsed = new Date(String(input.paid_at).trim());
    if (!Number.isNaN(parsed.getTime())) {
      eventAt = parsed;
    }
  }

  const ledgerAgentId = await resolveLedgerAgentId(tenantId, input.ledger_agent_id);
  const allocationAgentId = await resolveLedgerAgentId(tenantId, input.allocation_agent_id);

  let orderAgentId: number | null = null;
  if (input.order_id != null && input.order_id > 0) {
    const ordAgent = await prisma.order.findFirst({
      where: { id: input.order_id, tenant_id: tenantId, client_id: input.client_id },
      select: { agent_id: true }
    });
    orderAgentId = ordAgent?.agent_id ?? null;
  }

  const { assertFieldStaffBranchScopeForActor } = await import("../work-slots/work-slots.branch-scope");
  await assertFieldStaffBranchScopeForActor(tenantId, actorUserId, [
    client.agent_id,
    ledgerAgentId,
    allocationAgentId,
    orderAgentId
  ]);

  const allocationOrderIds = (input.allocation_order_ids ?? []).filter(
    (id) => Number.isFinite(id) && id > 0
  );
  const allocationMode: AllocationMode =
    input.allocation_mode === "cash" || input.allocation_mode === "consignment"
      ? input.allocation_mode
      : "none";

  const row = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        tenant_id: tenantId,
        client_id: input.client_id,
        order_id: input.order_id != null && input.order_id > 0 ? input.order_id : null,
        amount: amountDec,
        payment_type: pt,
        note: input.note?.trim() || null,
        created_by_user_id: uid,
        cash_desk_id: cashDeskId,
        workflow_status: "confirmed",
        paid_at: eventAt,
        received_at: eventAt,
        confirmed_at: eventAt,
        entry_kind: "payment",
        ledger_agent_id: ledgerAgentId
      }
    });

    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: input.client_id } },
      create: { tenant_id: tenantId, client_id: input.client_id, balance: amountDec },
      update: { balance: { increment: amountDec } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta: amountDec,
        note: `To‘lov #${p.id}${input.order_id ? ` (zakaz #${input.order_id})` : ""}`,
        user_id: uid
      }
    });

    return tx.payment.findFirstOrThrow({
      where: { id: p.id },
      include: paymentListInclude(tenantId)
    });
  });

  await appendClientAuditLog(tenantId, input.client_id, actorUserId, "client.payment", {
    payment_id: row.id,
    amount: input.amount,
    payment_type: pt,
    order_id: input.order_id ?? null
  });

  await allocatePayment(tenantId, row.id, uid, {
    mode: allocationMode,
    agent_id: allocationAgentId ?? ledgerAgentId ?? null,
    order_ids: allocationOrderIds
  });

  void invalidateDashboard(tenantId);

  return mapPaymentToListRow(row, tenantId);
}

