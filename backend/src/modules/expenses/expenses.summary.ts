import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { ExpenseSummaryByAgent, ExpenseSummaryByType } from "./expenses.types";
import { assertTenantAccess } from "./expenses.shared";

export async function getExpenseSummary(
  tenantId: number,
  from?: Date | string,
  to?: Date | string
): Promise<{ byType: ExpenseSummaryByType; byAgent: ExpenseSummaryByAgent }> {
  await assertTenantAccess(tenantId);

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const where: Prisma.ExpenseWhereInput = {
    tenant_id: tenantId,
    deleted_at: null,
    ...(Object.keys(dateFilter).length > 0 ? { expense_date: dateFilter } : {})
  };

  const allExpenses = await prisma.expense.findMany({
    where,
    select: {
      id: true,
      expense_type: true,
      amount: true,
      agent_id: true,
      status: true
    }
  });

  // Group by type
  const typeMap = new Map<string, { count: number; total: Prisma.Decimal }>();
  for (const e of allExpenses) {
    const entry = typeMap.get(e.expense_type);
    if (!entry) {
      typeMap.set(e.expense_type, { count: 1, total: e.amount });
    } else {
      entry.count++;
      entry.total = entry.total.add(e.amount);
    }
  }
  const byType: ExpenseSummaryByType = Array.from(typeMap.entries())
    .map(([key, v]) => ({
      key,
      label: key,
      count: v.count,
      total: v.total.toString()
    }))
    .sort((a, b) => b.total.localeCompare(a.total));

  // Group by agent
  const agentMap = new Map<number | null, { count: number; total: Prisma.Decimal }>();
  for (const e of allExpenses) {
    const entry = agentMap.get(e.agent_id);
    if (!entry) {
      agentMap.set(e.agent_id, { count: 1, total: e.amount });
    } else {
      entry.count++;
      entry.total = entry.total.add(e.amount);
    }
  }
  const agentIds = Array.from(agentMap.keys()).filter((k) => k !== null) as number[];
  const agents =
    agentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, name: true }
        })
      : [];
  const agentNameMap = new Map(agents.map((a) => [a.id, a.name]));

  const byAgent: ExpenseSummaryByAgent = Array.from(agentMap.entries())
    .map(([key, v]) => ({
      key: key === null ? "unassigned" : String(key),
      label: key === null ? "Unassigned" : agentNameMap.get(key) || `Agent #${key}`,
      count: v.count,
      total: v.total.toString()
    }))
    .sort((a, b) => b.total.localeCompare(a.total));

  return { byType, byAgent };
}
