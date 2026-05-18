import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent, AuditEntityType } from "../../lib/tenant-audit";
import type { PnlReport } from "./expenses.types";
import { assertTenantAccess } from "./expenses.shared";

export async function getPnlReport(
  tenantId: number,
  from?: Date | string,
  to?: Date | string
): Promise<PnlReport> {
  await assertTenantAccess(tenantId);

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const revenueResult = await prisma.order.aggregate({
    _sum: { total_sum: true },
    where: {
      tenant_id: tenantId,
      ...(Object.keys(dateFilter).length > 0 ? { created_at: dateFilter } : {})
    }
  });
  const revenue = revenueResult._sum.total_sum ?? new Prisma.Decimal(0);

  const expensesWhere: Prisma.ExpenseWhereInput = {
    tenant_id: tenantId,
    deleted_at: null,
    ...(Object.keys(dateFilter).length > 0 ? { expense_date: dateFilter } : {})
  };

  const [approvedResult, draftResult] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: { amount: true },
      where: { ...expensesWhere, status: "approved" }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      _count: { amount: true },
      where: { ...expensesWhere, status: "draft" }
    })
  ]);

  const totalApproved = approvedResult._sum.amount ?? new Prisma.Decimal(0);
  const totalDraft = draftResult._sum.amount ?? new Prisma.Decimal(0);
  const netProfit = revenue.sub(totalApproved);

  return {
    revenue: revenue.toString(),
    total_expenses_approved: totalApproved.toString(),
    total_expenses_draft: totalDraft.toString(),
    net_profit: netProfit.toString(),
    period_from: from ? new Date(from).toISOString() : undefined,
    period_to: to ? new Date(to).toISOString() : undefined
  };
}
