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
  allocatePaymentInTransaction,
  getPaymentAllocations,
  type AllocationMode,
  type PaymentAllocationRow
} from "./payment-allocations.service";

import { getPaymentDetail, type PaymentDetailPayload } from "./payment.query";

/**
 * Bekor qilish (arxiv): qator bazada qoladi, balans qaytariladi, taqsimotlar olib tashlanadi.
 * To‘liq tarix: `tenant_audit_events`, `delete_reason_ref`, `deleted_by_user_id`.
 */
export async function deletePayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  cancelReasonRef?: string | null
): Promise<void> {
  const reasonNote =
    cancelReasonRef != null && String(cancelReasonRef).trim()
      ? String(cancelReasonRef).trim().slice(0, 128)
      : null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, tenant_id: tenantId }
    });
    if (!payment) {
      throw new Error("NOT_FOUND");
    }
    if (payment.deleted_at != null) {
      throw new Error("ALREADY_VOIDED");
    }

    const wf = String(payment.workflow_status ?? "");
    const skipBalanceForNeverPosted =
      wf === "pending_confirmation" || wf === "rejected";

    const bal = await tx.clientBalance.findUnique({
      where: {
        tenant_id_client_id: { tenant_id: tenantId, client_id: payment.client_id }
      }
    });
    if (bal && !skipBalanceForNeverPosted) {
      const isExpense = String(payment.entry_kind ?? "payment") === "client_expense";
      if (isExpense) {
        await tx.clientBalance.update({
          where: { id: bal.id },
          data: { balance: { increment: payment.amount } }
        });
        await tx.clientBalanceMovement.create({
          data: {
            client_balance_id: bal.id,
            delta: payment.amount,
            note: reasonNote
              ? `Rasxod klient #${payment.id} bekor (arxiv) — ${reasonNote}`
              : `Rasxod klient #${payment.id} bekor qilindi (arxiv)`,
            user_id: actorUserId
          }
        });
      } else {
        await tx.clientBalance.update({
          where: { id: bal.id },
          data: { balance: { decrement: payment.amount } }
        });
        await tx.clientBalanceMovement.create({
          data: {
            client_balance_id: bal.id,
            delta: payment.amount.neg(),
            note: reasonNote
              ? `To'lov #${payment.id} bekor (arxiv) — ${reasonNote}`
              : `To'lov #${payment.id} bekor qilindi (arxiv)`,
            user_id: actorUserId
          }
        });
      }
    }

    await tx.paymentAllocation.deleteMany({
      where: { tenant_id: tenantId, payment_id: paymentId }
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        workflow_status: "deleted",
        deleted_at: now,
        deleted_by_user_id:
          actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null,
        delete_reason_ref: reasonNote
      }
    });
  });

  void invalidateDashboard(tenantId);

  if (actorUserId) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "payment.void",
      payload: {
        payment_id: paymentId,
        soft: true,
        ...(reasonNote ? { cancel_reason_ref: reasonNote } : {})
      }
    });
  }
}

/** Arxivdan qayta tiklash: balansni qayta qo‘llash, bekor maydonlarini tozalash. */
export async function restorePayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, tenant_id: tenantId }
    });
    if (!payment) throw new Error("NOT_FOUND");
    if (payment.deleted_at == null) throw new Error("NOT_VOIDED");

    const bal = await tx.clientBalance.findUnique({
      where: {
        tenant_id_client_id: { tenant_id: tenantId, client_id: payment.client_id }
      }
    });
    if (bal) {
      const isExpense = String(payment.entry_kind ?? "payment") === "client_expense";
      if (isExpense) {
        await tx.clientBalance.update({
          where: { id: bal.id },
          data: { balance: { decrement: payment.amount } }
        });
        await tx.clientBalanceMovement.create({
          data: {
            client_balance_id: bal.id,
            delta: payment.amount.neg(),
            note: `Rasxod klient #${payment.id} tiklandi`,
            user_id: actorUserId
          }
        });
      } else {
        await tx.clientBalance.update({
          where: { id: bal.id },
          data: { balance: { increment: payment.amount } }
        });
        await tx.clientBalanceMovement.create({
          data: {
            client_balance_id: bal.id,
            delta: payment.amount,
            note: `To'lov #${payment.id} tiklandi`,
            user_id: actorUserId
          }
        });
      }
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        workflow_status: "confirmed",
        deleted_at: null,
        deleted_by_user_id: null,
        delete_reason_ref: null
      }
    });
  });

  void invalidateDashboard(tenantId);

  if (actorUserId) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "payment.restore",
      payload: { payment_id: paymentId }
    });
  }
}

/**
 * Ekspeditor / mobil «ariza» — `pending_confirmation`: balans hali o‘zgarmagan.
 * Tasdiqda mijoz balansiga qo‘shiladi, FIFO taqsimot ishga tushadi.
 */
export async function confirmPendingPayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null
): Promise<PaymentDetailPayload> {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({
      where: { id: paymentId, tenant_id: tenantId, deleted_at: null }
    });
    if (!p) throw new Error("NOT_FOUND");
    if (String(p.entry_kind ?? "payment") !== "payment") throw new Error("BAD_ENTRY_KIND");
    if (p.workflow_status !== "pending_confirmation") throw new Error("NOT_PENDING");

    const amountDec = p.amount;
    const eventAt = p.paid_at ?? new Date();

    const bal = await tx.clientBalance.upsert({
      where: { tenant_id_client_id: { tenant_id: tenantId, client_id: p.client_id } },
      create: { tenant_id: tenantId, client_id: p.client_id, balance: amountDec },
      update: { balance: { increment: amountDec } }
    });
    await tx.clientBalanceMovement.create({
      data: {
        client_balance_id: bal.id,
        delta: amountDec,
        note: `To'lov #${p.id} tasdiq (ariza)`,
        user_id: uid
      }
    });

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        workflow_status: "confirmed",
        paid_at: p.paid_at ?? eventAt,
        received_at: p.received_at ?? eventAt,
        confirmed_at: eventAt
      }
    });

    await allocatePaymentInTransaction(tx, tenantId, paymentId, uid, {
      mode: "none",
      agent_id: null,
      order_ids: []
    });
  });

  void invalidateDashboard(tenantId);

  const pRow = await prisma.payment.findFirst({
    where: { id: paymentId, tenant_id: tenantId },
    select: { client_id: true }
  });
  if (pRow) {
    await appendClientAuditLog(tenantId, pRow.client_id, actorUserId, "client.payment", {
      payment_id: paymentId,
      source: "confirm_pending"
    });
  }

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "payment.confirm_pending",
      payload: { payment_id: paymentId }
    });
  }

  const detail = await getPaymentDetail(tenantId, paymentId);
  if (!detail) throw new Error("NOT_FOUND");
  return detail;
}

/** Rad etish — balansga tegmaydi (`rejected`). */
export async function rejectPendingPayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  reason?: string | null
): Promise<void> {
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;
  const note = reason != null && String(reason).trim() ? String(reason).trim().slice(0, 500) : null;

  const row = await prisma.payment.findFirst({
    where: { id: paymentId, tenant_id: tenantId, deleted_at: null }
  });
  if (!row) throw new Error("NOT_FOUND");
  if (row.workflow_status !== "pending_confirmation") throw new Error("NOT_PENDING");

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      workflow_status: "rejected",
      note:
        note != null
          ? `${row.note != null && String(row.note).trim() ? `${String(row.note).trim()}\n` : ""}[reject] ${note}`
          : row.note
    }
  });

  void invalidateDashboard(tenantId);

  if (uid) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId: uid,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "payment.reject_pending",
      payload: { payment_id: paymentId, ...(note ? { reason: note } : {}) }
    });
  }
}

const BATCH_CONFIRM_CONCURRENCY = 5;

export async function confirmPendingPaymentsBatch(
  tenantId: number,
  ids: number[],
  actorUserId: number | null
): Promise<{ ok: number[]; failed: { id: number; error: string }[] }> {
  const validIds = [...new Set(ids.filter((id) => Number.isFinite(id) && id >= 1))];
  const ok: number[] = [];
  const failed: { id: number; error: string }[] = [];

  for (let i = 0; i < validIds.length; i += BATCH_CONFIRM_CONCURRENCY) {
    const chunk = validIds.slice(i, i + BATCH_CONFIRM_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((id) => confirmPendingPayment(tenantId, id, actorUserId))
    );
    for (let j = 0; j < chunk.length; j++) {
      const id = chunk[j]!;
      const result = results[j]!;
      if (result.status === "fulfilled") {
        ok.push(id);
      } else {
        failed.push({
          id,
          error: result.reason instanceof Error ? result.reason.message : "ERR"
        });
      }
    }
  }
  return { ok, failed };
}

