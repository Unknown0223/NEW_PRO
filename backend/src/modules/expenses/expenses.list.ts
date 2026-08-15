import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import {
  intersectRequestedAgentIds,
  type ScopedReportActor
} from "../access/access-agent-scope";
import type { ExpenseListQuery, ExpenseListRow } from "./expenses.types";
import { assertTenantAccess, enrichExpense, resolveNames } from "./expenses.shared";

export async function listExpenses(
  tenantId: number,
  q: ExpenseListQuery,
  actor?: ScopedReportActor
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
  const agentScope = actor
    ? intersectRequestedAgentIds(
        q.agent_id != null && q.agent_id > 0 ? [q.agent_id] : undefined,
        actor
      )
    : {
        agentIds: q.agent_id != null && q.agent_id > 0 ? [q.agent_id] : [],
        restricted: false
      };
  if (agentScope.restricted) {
    where.agent_id = { in: agentScope.agentIds };
  } else if (agentScope.agentIds.length === 1) {
    where.agent_id = agentScope.agentIds[0];
  } else if (agentScope.agentIds.length > 1) {
    where.agent_id = { in: agentScope.agentIds };
  }
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
