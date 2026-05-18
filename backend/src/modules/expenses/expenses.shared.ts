import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ExpenseListRow } from "./expenses.types";

export async function assertTenantAccess(tenantId: number) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant || !tenant.is_active) {
    throw new Error("TENANT_NOT_FOUND");
  }
  return tenant;
}

// ── Name resolution helper ───────────────────────────────────────────────

/** Resolve user/warehouse names for a list of expenses */
export async function resolveNames(expenses: Array<{
  id: number; agent_id: number | null; warehouse_id: number | null;
  created_by_user_id: number | null; approved_by_user_id: number | null;
  deleted_by_user_id?: number | null;
}>) {
  const userIds = new Set<number>();
  const warehouseIds = new Set<number>();
  for (const e of expenses) {
    if (e.agent_id) userIds.add(e.agent_id);
    if (e.created_by_user_id) userIds.add(e.created_by_user_id);
    if (e.approved_by_user_id) userIds.add(e.approved_by_user_id);
    if (e.deleted_by_user_id) userIds.add(e.deleted_by_user_id);
    if (e.warehouse_id) warehouseIds.add(e.warehouse_id);
  }

  const [users, warehouses] = await Promise.all([
    userIds.size > 0 ? prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } }) : Promise.resolve([]),
    warehouseIds.size > 0 ? prisma.warehouse.findMany({ where: { id: { in: [...warehouseIds] } }, select: { id: true, name: true } }) : Promise.resolve([])
  ]);

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const whMap = new Map(warehouses.map((w) => [w.id, w.name]));
  return { userMap, whMap };
}

export function enrichExpense(
  expense: {
    id: number;
    expense_type: string;
    agent_id: number | null;
    amount: Prisma.Decimal;
    currency: string;
    warehouse_id: number | null;
    status: string;
    note: string | null;
    expense_date: Date;
    created_by_user_id: number | null;
    approved_by_user_id: number | null;
    rejection_note: string | null;
    created_at: Date;
    deleted_at?: Date | null;
    deleted_by_user_id?: number | null;
    delete_reason_ref?: string | null;
  },
  userMap: Map<number, string>,
  whMap: Map<number, string>
): ExpenseListRow {
  const dbid = expense.deleted_by_user_id ?? null;
  return {
    id: expense.id,
    expense_type: expense.expense_type,
    agent_id: expense.agent_id,
    agent_name: expense.agent_id != null ? (userMap.get(expense.agent_id) ?? null) : null,
    amount: expense.amount.toString(),
    currency: expense.currency,
    warehouse_id: expense.warehouse_id,
    warehouse_name: expense.warehouse_id != null ? (whMap.get(expense.warehouse_id) ?? null) : null,
    status: expense.status,
    note: expense.note,
    expense_date: expense.expense_date.toISOString(),
    created_by_user_id: expense.created_by_user_id,
    created_by_name: expense.created_by_user_id != null ? (userMap.get(expense.created_by_user_id) ?? null) : null,
    approved_by_user_id: expense.approved_by_user_id,
    approved_by_name: expense.approved_by_user_id != null ? (userMap.get(expense.approved_by_user_id) ?? null) : null,
    rejection_note: expense.rejection_note,
    created_at: expense.created_at.toISOString(),
    deleted_at: expense.deleted_at ? expense.deleted_at.toISOString() : null,
    deleted_by_user_id: dbid,
    deleted_by_name: dbid != null ? (userMap.get(dbid) ?? null) : null,
    delete_reason_ref: expense.delete_reason_ref?.trim() || null
  };
}
