/**
 * ЗАРПЛАТА — to‘lovlar (выплаченные зарплаты) va UI tanlovlari.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { PAYROLL_ROLES, payrollRoleLabel } from "./payroll.roles";
import { sumAmounts, toNumber } from "./payroll.money";

export type PayrollPaymentRow = {
  id: number;
  period_id: number | null;
  month: string | null;
  user_id: number;
  fio: string;
  role: string;
  role_label: string;
  amount: number;
  method: string;
  cash_desk_id: number | null;
  cash_desk_name: string | null;
  paid_at: string;
  comment: string | null;
  voided_at: string | null;
};

function mapPayment(p: {
  id: number;
  period_id: number | null;
  user_id: number;
  amount: Prisma.Decimal;
  method: string;
  cash_desk_id: number | null;
  paid_at: Date;
  comment: string | null;
  voided_at: Date | null;
  period: { month: string } | null;
  user: { name: string; role: string };
  cash_desk?: { name: string } | null;
}): PayrollPaymentRow {
  return {
    id: p.id,
    period_id: p.period_id,
    month: p.period?.month ?? p.paid_at.toISOString().slice(0, 7),
    user_id: p.user_id,
    fio: p.user.name,
    role: p.user.role,
    role_label: payrollRoleLabel(p.user.role),
    amount: toNumber(p.amount),
    method: p.method,
    cash_desk_id: p.cash_desk_id,
    cash_desk_name: p.cash_desk?.name ?? null,
    paid_at: p.paid_at.toISOString(),
    comment: p.comment,
    voided_at: p.voided_at ? p.voided_at.toISOString() : null
  };
}

const PAYMENT_INCLUDE = {
  period: { select: { month: true } },
  user: { select: { name: true, role: true } },
  cash_desk: { select: { name: true } }
} satisfies Prisma.PayrollPaymentInclude;

export async function listPayments(
  tenantId: number,
  q: { month?: string; user_id?: number; include_voided?: boolean }
): Promise<{ rows: PayrollPaymentRow[]; total: number; paid: number }> {
  const where: Prisma.PayrollPaymentWhereInput = { tenant_id: tenantId };
  if (q.user_id != null) where.user_id = q.user_id;
  if (!q.include_voided) where.voided_at = null;
  if (q.month) {
    const [y, m] = q.month.split("-").map((x) => Number.parseInt(x, 10));
    where.paid_at = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1))
    };
  }

  const rows = await prisma.payrollPayment.findMany({
    where,
    orderBy: { paid_at: "desc" },
    take: 1000,
    include: PAYMENT_INCLUDE
  });
  const active = rows.filter((r) => !r.voided_at);
  return {
    rows: rows.map(mapPayment),
    total: sumAmounts(active.map((r) => toNumber(r.amount))),
    paid: active.length
  };
}

export async function createPayment(
  tenantId: number,
  input: {
    period_id?: number | null;
    month?: string;
    user_id: number;
    amount: number;
    method?: string;
    cash_desk_id?: number | null;
    paid_at?: string;
    comment?: string | null;
  },
  actorUserId: number | null
): Promise<number> {
  const user = await prisma.user.findFirst({
    where: { tenant_id: tenantId, id: input.user_id },
    select: { id: true }
  });
  if (!user) throw new Error("BAD_USER");

  let periodId = input.period_id ?? null;
  if (periodId == null && input.month) {
    const p = await prisma.payrollPeriod.findUnique({
      where: { tenant_id_month: { tenant_id: tenantId, month: input.month } }
    });
    periodId = p?.id ?? null;
  }
  if (periodId != null) {
    const p = await prisma.payrollPeriod.findFirst({ where: { tenant_id: tenantId, id: periodId } });
    if (!p) throw new Error("BAD_PERIOD");
  }

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollPayment.create({
      data: {
        tenant_id: tenantId,
        period_id: periodId,
        user_id: input.user_id,
        amount: input.amount,
        method: input.method ?? "cash",
        cash_desk_id: input.cash_desk_id ?? null,
        paid_at: input.paid_at ? new Date(input.paid_at) : new Date(),
        comment: input.comment?.trim() || null,
        created_by: actorUserId
      }
    });
    if (periodId != null) await refreshPeriodPaid(tx, tenantId, periodId);
    return created;
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_payment",
    entityId: row.id,
    action: "create",
    payload: { user_id: input.user_id, amount: input.amount, method: input.method ?? "cash" }
  });
  return row.id;
}

export async function voidPayment(
  tenantId: number,
  id: number,
  actorUserId: number | null
): Promise<void> {
  const row = await prisma.payrollPayment.findFirst({ where: { tenant_id: tenantId, id } });
  if (!row) throw new Error("NOT_FOUND");
  if (row.voided_at) throw new Error("ALREADY_VOIDED");

  await prisma.$transaction(async (tx) => {
    await tx.payrollPayment.update({
      where: { id },
      data: { voided_at: new Date(), voided_by: actorUserId }
    });
    if (row.period_id != null) await refreshPeriodPaid(tx, tenantId, row.period_id);
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_payment",
    entityId: id,
    action: "void",
    payload: { user_id: row.user_id, amount: toNumber(row.amount) }
  });
}

type Tx = Prisma.TransactionClient;

async function refreshPeriodPaid(tx: Tx, tenantId: number, periodId: number): Promise<void> {
  const rows = await tx.payrollPayment.findMany({
    where: { tenant_id: tenantId, period_id: periodId, voided_at: null },
    select: { amount: true }
  });
  const total = sumAmounts(rows.map((r) => toNumber(r.amount)));
  await tx.payrollPeriod.update({
    where: { id: periodId },
    data: { paid_amount: total, status: total > 0 ? "paid" : "approved" }
  });
}

/** UI tanlovlari: rollar, KPI guruhlari, formulalar, setkalar, kassalar, xodimlar. */
export async function listPayrollOptions(tenantId: number): Promise<{
  roles: Array<{ role: string; label: string }>;
  kpi_groups: Array<{ id: number; name: string; agent_total: number }>;
  formulas: Array<{ id: number; name: string; kind: string; kpi_group_id: number | null }>;
  grids: Array<{ id: number; name: string; metric: string; mode: string }>;
  cash_desks: Array<{ id: number; name: string }>;
  months: string[];
}> {
  const [groups, formulas, grids, desks, periods] = await Promise.all([
    prisma.kpiGroup.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, _count: { select: { agents: true } } }
    }),
    prisma.payrollFormula.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, kind: true, kpi_group_id: true }
    }),
    prisma.payrollGrid.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, metric: true, mode: true }
    }),
    prisma.cashDesk.findMany({
      where: { tenant_id: tenantId, is_active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.payrollPeriod.findMany({
      where: { tenant_id: tenantId },
      orderBy: { month: "desc" },
      take: 24,
      select: { month: true }
    })
  ]);

  const now = new Date();
  const months = [...new Set([
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
    ...periods.map((p) => p.month)
  ])];

  return {
    roles: PAYROLL_ROLES.map((r) => ({ role: r.role, label: r.labelRu })),
    kpi_groups: groups.map((g) => ({ id: g.id, name: g.name, agent_total: g._count.agents })),
    formulas: formulas.map((f) => ({
      id: f.id,
      name: f.name,
      kind: f.kind,
      kpi_group_id: f.kpi_group_id
    })),
    grids: grids.map((g) => ({ id: g.id, name: g.name, metric: g.metric, mode: g.mode })),
    cash_desks: desks.map((d) => ({ id: d.id, name: d.name })),
    months
  };
}
