import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { CreateExpenseInput, ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

export async function createExpense(
  tenantId: number,
  input: CreateExpenseInput,
  actorUserId: number | null
): Promise<ExpenseListRow> {
  await assertTenantAccess(tenantId);

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("BAD_AMOUNT");
  }

  const type = input.expense_type.trim();
  if (!type) throw new Error("BAD_EXPENSE_TYPE");

  if (input.agent_id != null && input.agent_id > 0) {
    const agent = await prisma.user.findFirst({
      where: { id: input.agent_id, tenant_id: tenantId }
    });
    if (!agent) throw new Error("BAD_AGENT");
  }

  if (input.warehouse_id != null && input.warehouse_id > 0) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: input.warehouse_id, tenant_id: tenantId }
    });
    if (!wh) throw new Error("BAD_WAREHOUSE");
  }

  const amountDec = new Prisma.Decimal(input.amount);
  const uid = actorUserId != null && actorUserId > 0 ? actorUserId : null;
  const expenseDate = input.expense_date ?? new Date();

  const expense = await prisma.expense.create({
    data: {
      tenant_id: tenantId,
      expense_type: type,
      agent_id: input.agent_id != null && input.agent_id > 0 ? input.agent_id : null,
      amount: amountDec,
      currency: input.currency || "UZS",
      warehouse_id: input.warehouse_id != null && input.warehouse_id > 0 ? input.warehouse_id : null,
      status: "draft",
      note: input.note?.trim() || null,
      expense_date: expenseDate,
      created_by_user_id: uid
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: uid,
    entityType: AuditEntityType.finance,
    entityId: String(expense.id),
    action: "expense.create",
    payload: { expense_id: expense.id, amount: input.amount, expense_type: type, status: "draft" }
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

// ── Update expense ───────────────────────────────────────────────────────

export async function updateExpense(
  tenantId: number,
  expenseId: number,
  input: Partial<CreateExpenseInput>,
  actorUserId: number | null
): Promise<ExpenseListRow> {
  await assertTenantAccess(tenantId);

  const existing = await prisma.expense.findFirst({
    where: { id: expenseId, tenant_id: tenantId }
  });
  if (!existing) throw new Error("NOT_FOUND");
  if (existing.deleted_at != null) throw new Error("VOIDED");
  if (existing.status !== "draft") throw new Error("CANNOT_EDIT_NON_DRAFT");

  if (input.amount != null && (!Number.isFinite(input.amount) || input.amount <= 0)) {
    throw new Error("BAD_AMOUNT");
  }

  const updateData: Prisma.ExpenseUpdateInput = {};
  if (input.expense_type) updateData.expense_type = input.expense_type.trim();
  if (input.amount != null) updateData.amount = new Prisma.Decimal(input.amount);
  if (input.currency) updateData.currency = input.currency;
  if (input.agent_id != null) {
    if (input.agent_id > 0) {
      const agent = await prisma.user.findFirst({
        where: { id: input.agent_id, tenant_id: tenantId }
      });
      if (!agent) throw new Error("BAD_AGENT");
    }
    updateData.agent_id = input.agent_id > 0 ? input.agent_id : null;
  }
  if (input.warehouse_id != null) {
    if (input.warehouse_id > 0) {
      const wh = await prisma.warehouse.findFirst({
        where: { id: input.warehouse_id, tenant_id: tenantId }
      });
      if (!wh) throw new Error("BAD_WAREHOUSE");
    }
    updateData.warehouse_id = input.warehouse_id > 0 ? input.warehouse_id : null;
  }
  if (input.note !== undefined) updateData.note = input.note?.trim() || null;
  if (input.expense_date) updateData.expense_date = input.expense_date;

  const expense = await prisma.expense.update({
    where: { id: expenseId },
    data: updateData
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
