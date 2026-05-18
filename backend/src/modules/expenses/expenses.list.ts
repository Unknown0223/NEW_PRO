import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ExpenseListQuery, ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

export async function listExpenses(
  tenantId: number,
  q: ExpenseListQuery
): Promise<{ data: ExpenseListRow[]; total: number; page: number; limit: number }> {
  await assertTenantAccess(tenantId);

  const where: Prisma.ExpenseWhereInput = { tenant_id: tenantId };

  if (q.archive) {
    where.deleted_at = { not: null };
  } else {
    where.deleted_at = null;
  }

  if (q.status) where.status = q.status;
  if (q.expense_type) where.expense_type = q.expense_type;
  if (q.agent_id != null) where.agent_id = q.agent_id;
  if (q.warehouse_id != null) where.warehouse_id = q.warehouse_id;
  if (q.from || q.to) {
    where.expense_date = {
      ...(q.from ? { gte: new Date(q.from) } : {}),
      ...(q.to ? { lte: new Date(q.to) } : {})
    };
  }

  const [total, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { expense_date: "desc" },
      skip: (q.page - 1) * q.limit,
      take: q.limit
    })
  ]);

  const { userMap, whMap } = await resolveNames(rows);

  return {
    total,
    page: q.page,
    limit: q.limit,
    data: rows.map((row) => enrichExpense(row, userMap, whMap))
  };
}
