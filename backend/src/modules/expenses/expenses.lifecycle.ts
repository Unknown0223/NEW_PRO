import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

export async function deleteExpense(
  tenantId: number,
  expenseId: number,
  actorUserId: number | null,
  reasonRef?: string | null
): Promise<void> {
  await assertTenantAccess(tenantId);

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.deleted_at != null) throw new Error("ALREADY_VOIDED");
  if (existing.status !== "draft") throw new Error("CANNOT_DELETE_NON_DRAFT");

  const note =
    reasonRef != null && String(reasonRef).trim() ? String(reasonRef).trim().slice(0, 128) : null;
  const now = new Date();
  const uid =
    actorUserId != null && Number.isFinite(actorUserId) && actorUserId > 0 ? actorUserId : null;

  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      deleted_at: now,
      deleted_by_user_id: uid,
      delete_reason_ref: note
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: uid,
    entityType: AuditEntityType.finance,
    entityId: String(expenseId),
    action: "expense.void",
    payload: { expense_id: expenseId, soft: true, ...(note ? { reason: note } : {}) }
  });
}

export async function restoreExpense(
  tenantId: number,
  expenseId: number,
  actorUserId: number | null
): Promise<void> {
  await assertTenantAccess(tenantId);
  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.deleted_at == null) throw new Error("NOT_VOIDED");
  if (existing.status !== "draft") throw new Error("CANNOT_RESTORE_NON_DRAFT");

  await prisma.expense.update({
    where: { id: expenseId },
    data: { deleted_at: null, deleted_by_user_id: null, delete_reason_ref: null }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: actorUserId != null && actorUserId > 0 ? actorUserId : null,
    entityType: AuditEntityType.finance,
    entityId: String(expenseId),
    action: "expense.restore",
    payload: { expense_id: expenseId }
  });
}

// ── Approve expense (draft → approved) ───────────────────────────────────

export async function approveExpense(
  tenantId: number,
  expenseId: number,
  approverId: number
): Promise<ExpenseListRow> {
  await assertTenantAccess(tenantId);

  const expense = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({
      where: { id: expenseId, tenant_id: tenantId }
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.deleted_at != null) throw new Error("VOIDED");
    if (existing.status !== "draft") throw new Error("ALREADY_PROCESSED");

    return tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "approved",
        approved_by_user_id: approverId
      }
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: approverId,
    entityType: AuditEntityType.finance,
    entityId: String(expenseId),
    action: "expense.approve",
    payload: { expense_id: expenseId, amount: expense.amount.toString() }
  });

  const { userMap, whMap } = await resolveNames([{
    id: expense.id,
    agent_id: expense.agent_id,
    warehouse_id: expense.warehouse_id,
    created_by_user_id: expense.created_by_user_id,
    approved_by_user_id: expense.approved_by_user_id,
    deleted_by_user_id: expense.deleted_by_user_id
  }]);
  return enrichExpense(expense, userMap, whMap);
}

// ── Reject expense (draft → rejected) ────────────────────────────────────

export async function rejectExpense(
  tenantId: number,
  expenseId: number,
  approverId: number,
  note: string
): Promise<ExpenseListRow> {
  await assertTenantAccess(tenantId);

  if (!note.trim()) throw new Error("REJECTION_NOTE_REQUIRED");

  const expense = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({
      where: { id: expenseId, tenant_id: tenantId }
    });
    if (!existing) throw new Error("NOT_FOUND");
    if (existing.deleted_at != null) throw new Error("VOIDED");
    if (existing.status !== "draft") throw new Error("ALREADY_PROCESSED");

    return tx.expense.update({
      where: { id: expenseId },
      data: {
        status: "rejected",
        approved_by_user_id: approverId,
        rejection_note: note.trim()
      }
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: approverId,
    entityType: AuditEntityType.finance,
    entityId: String(expenseId),
    action: "expense.reject",
    payload: { expense_id: expenseId, rejection_note: note.trim() }
  });

  const { userMap, whMap } = await resolveNames([{
    id: expense.id,
    agent_id: expense.agent_id,
    warehouse_id: expense.warehouse_id,
    created_by_user_id: expense.created_by_user_id,
    approved_by_user_id: expense.approved_by_user_id,
    deleted_by_user_id: expense.deleted_by_user_id
  }]);
  return enrichExpense(expense, userMap, whMap);
}
