import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

export async function getExpense(
  tenantId: number,
  expenseId: number
): Promise<ExpenseListRow> {
  await assertTenantAccess(tenantId);

  const row = await prisma.expense.findFirst({
    where: { id: expenseId, tenant_id: tenantId }
  });
  if (!row) throw new Error("NOT_FOUND");

  const { userMap, whMap } = await resolveNames([{
    id: row.id,
    agent_id: row.agent_id,
    warehouse_id: row.warehouse_id,
    created_by_user_id: row.created_by_user_id,
    approved_by_user_id: row.approved_by_user_id,
    deleted_by_user_id: row.deleted_by_user_id
  }]);
  return enrichExpense(row, userMap, whMap);
}
