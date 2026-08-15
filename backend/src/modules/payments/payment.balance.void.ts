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
  softRestoreData,
  softVoidData,
  requireRestoreComment
} from "../../lib/soft-void";

import { voidPaymentEditGrantsInTx, restorePaymentEditGrantsInTx } from "./payment-edit-grants.service";

/** Snapshot format for payment allocations (void → restore). */
type AllocationSnapshotItem = {
  order_id: number;
  amount: string;
  created_at?: string;
};

function parseAllocationsSnapshot(raw: unknown): AllocationSnapshotItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AllocationSnapshotItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const orderId = Number(row.order_id);
    const amount =
      typeof row.amount === "string"
        ? row.amount
        : row.amount != null
          ? String(row.amount)
          : "";
    if (!Number.isFinite(orderId) || orderId <= 0 || !amount) continue;
    out.push({
      order_id: Math.floor(orderId),
      amount,
      created_at: typeof row.created_at === "string" ? row.created_at : undefined
    });
  }
  return out;
}

/**
 * Bekor qilish (arxiv): qator bazada qoladi, balans qaytariladi, taqsimotlar snapshot + olib tashlanadi.
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
  let clientId: number | null = null;
  let amountValue: string | null = null;
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
    clientId = payment.client_id;
    amountValue = payment.amount.toString();

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

    const allocRows = await tx.paymentAllocation.findMany({
      where: { tenant_id: tenantId, payment_id: paymentId },
      orderBy: { order_id: "asc" },
      select: { order_id: true, amount: true, created_at: true }
    });
    const allocationsSnapshot: AllocationSnapshotItem[] = allocRows.map((a) => ({
      order_id: a.order_id,
      amount: a.amount.toString(),
      created_at: a.created_at.toISOString()
    }));

    await tx.paymentAllocation.deleteMany({
      where: { tenant_id: tenantId, payment_id: paymentId }
    });
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        workflow_status: "deleted",
        ...softVoidData(actorUserId, reasonNote, { now }),
        allocations_snapshot: allocationsSnapshot
      }
    });
    await voidPaymentEditGrantsInTx(tx, tenantId, paymentId, {
      voidedAt: now,
      cancelReasonRef: reasonNote,
      actorUserId:
        actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null,
      expeditorUserId:
        payment.expeditor_user_id != null && payment.expeditor_user_id > 0
          ? payment.expeditor_user_id
          : null
    });
  });

  void invalidateDashboard(tenantId);

  if (clientId != null) {
    await appendClientAuditLog(tenantId, clientId, actorUserId, "client.payment_void", {
      payment_id: paymentId,
      amount: amountValue,
      reason: reasonNote
    });
  }

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

/** Arxivdan qayta tiklash: balansni qayta qo‘llash, taqsimotlarni snapshotdan qayta yaratish. */
export async function restorePayment(
  tenantId: number,
  paymentId: number,
  actorUserId: number | null,
  restoreComment: string
): Promise<void> {
  const commentText = requireRestoreComment(restoreComment);

  const now = new Date();
  const restoreLine = `Восстановлено: ${commentText}`;
  let clientId: number | null = null;
  let amountValue: string | null = null;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findFirst({
      where: { id: paymentId, tenant_id: tenantId }
    });
    if (!payment) throw new Error("NOT_FOUND");
    if (payment.deleted_at == null) throw new Error("NOT_VOIDED");
    clientId = payment.client_id;
    amountValue = payment.amount.toString();

    const prevNote = payment.note?.trim() ?? "";
    const nextNote = prevNote ? `${prevNote}\n${restoreLine}` : restoreLine;

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
            note: `Rasxod klient #${payment.id} tiklandi — ${commentText}`,
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
            note: `To'lov #${payment.id} tiklandi — ${commentText}`,
            user_id: actorUserId
          }
        });
      }
    }

    const snapshot = parseAllocationsSnapshot(payment.allocations_snapshot);
    if (snapshot.length > 0) {
      await tx.paymentAllocation.createMany({
        data: snapshot.map((s) => {
          const createdAt = s.created_at ? new Date(s.created_at) : null;
          const base = {
            tenant_id: tenantId,
            payment_id: paymentId,
            order_id: s.order_id,
            amount: new Prisma.Decimal(s.amount)
          };
          if (createdAt && Number.isFinite(createdAt.getTime())) {
            return { ...base, created_at: createdAt };
          }
          return base;
        })
      });
    }

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        workflow_status: "confirmed",
        ...softRestoreData(),
        note: nextNote,
        allocations_snapshot: Prisma.DbNull
      }
    });
    await restorePaymentEditGrantsInTx(tx, tenantId, paymentId, {
      restoredAt: now,
      restoreComment: commentText
    });
  });

  void invalidateDashboard(tenantId);

  if (clientId != null) {
    await appendClientAuditLog(tenantId, clientId, actorUserId, "client.payment_restore", {
      payment_id: paymentId,
      amount: amountValue,
      reason: commentText
    });
  }

  if (actorUserId) {
    await appendTenantAuditEvent({
      tenantId,
      actorUserId,
      entityType: AuditEntityType.finance,
      entityId: String(paymentId),
      action: "payment.restore",
      payload: {
        payment_id: paymentId,
        comment: commentText
      }
    });
  }
}
