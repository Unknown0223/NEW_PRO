/**
 * ЗАРПЛАТА — oylik davr: hisoblash, tasdiqlash, bloklash.
 *
 * Holatlar: `draft` → `calculated` → `approved` → `paid`; `locked` — tahrirlash yopiq.
 * Qayta hisoblashda qo‘lda kiritilgan qiymatlar (`manual_net`, tuzatishlar, izoh) saqlanadi.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { getFormulaForEngine, listAssignments } from "./payroll.crud";
import { entryToRow, sumPeriodNet } from "./payroll.entry-row";
import { computePayrollMonth } from "./payroll.engine";
import { collectPayrollMetrics } from "./payroll.metrics";
import { sumAmounts, toNumber } from "./payroll.money";
import type {
  PayrollAdjustment,
  PayrollBreakdownLine,
  PayrollEmployee,
  PayrollEntryResult
} from "./payroll.types";

export const PAYROLL_PERIOD_STATUSES = ["draft", "calculated", "approved", "paid", "locked"] as const;
export type PayrollPeriodStatus = (typeof PAYROLL_PERIOD_STATUSES)[number];

export type PayrollPeriodRow = {
  id: number;
  month: string;
  status: PayrollPeriodStatus;
  total_amount: number;
  paid_amount: number;
  entry_count: number;
  calculated_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  comment: string | null;
};

function isoOrNull(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export async function listPeriods(
  tenantId: number,
  opts?: { limit?: number }
): Promise<PayrollPeriodRow[]> {
  const rows = await prisma.payrollPeriod.findMany({
    where: { tenant_id: tenantId },
    orderBy: { month: "desc" },
    take: opts?.limit ?? 24,
    include: { _count: { select: { entries: true } } }
  });
  return rows.map((p) => ({
    id: p.id,
    month: p.month,
    status: p.status as PayrollPeriodStatus,
    total_amount: toNumber(p.total_amount),
    paid_amount: toNumber(p.paid_amount),
    entry_count: p._count.entries,
    calculated_at: isoOrNull(p.calculated_at),
    approved_at: isoOrNull(p.approved_at),
    locked_at: isoOrNull(p.locked_at),
    comment: p.comment
  }));
}

export async function getOrInitPeriod(tenantId: number, month: string): Promise<PayrollPeriodRow> {
  const existing = await prisma.payrollPeriod.findUnique({
    where: { tenant_id_month: { tenant_id: tenantId, month } },
    include: { _count: { select: { entries: true } } }
  });
  if (existing) {
    return {
      id: existing.id,
      month: existing.month,
      status: existing.status as PayrollPeriodStatus,
      total_amount: toNumber(existing.total_amount),
      paid_amount: toNumber(existing.paid_amount),
      entry_count: existing._count.entries,
      calculated_at: isoOrNull(existing.calculated_at),
      approved_at: isoOrNull(existing.approved_at),
      locked_at: isoOrNull(existing.locked_at),
      comment: existing.comment
    };
  }
  const created = await prisma.payrollPeriod.create({
    data: { tenant_id: tenantId, month, status: "draft" }
  });
  return {
    id: created.id,
    month: created.month,
    status: "draft",
    total_amount: 0,
    paid_amount: 0,
    entry_count: 0,
    calculated_at: null,
    approved_at: null,
    locked_at: null,
    comment: null
  };
}

export async function assertEditable(period: { status: string }): Promise<void> {
  if (period.status === "locked") throw new Error("PERIOD_LOCKED");
  if (period.status === "paid") throw new Error("PERIOD_PAID");
}

/** Mavjud qatorlardan qo‘lda kiritilgan qiymatlarni olish. */
function readManualState(rows: Array<{ user_id: number; manual_net: Prisma.Decimal | null; breakdown: Prisma.JsonValue; comment: string | null }>) {
  const manualNetByUser: Record<number, number | null> = {};
  const adjustmentsByUser: Record<number, PayrollAdjustment[]> = {};
  const commentByUser: Record<number, string> = {};

  for (const r of rows) {
    if (r.manual_net != null) manualNetByUser[r.user_id] = toNumber(r.manual_net);
    if (r.comment) commentByUser[r.user_id] = r.comment;
    const lines = Array.isArray(r.breakdown) ? (r.breakdown as unknown as PayrollBreakdownLine[]) : [];
    const adjustments = lines
      .filter((l) => l && typeof l.code === "string" && l.code.startsWith("adjustment_"))
      .map((l) => ({ code: l.code.replace(/^adjustment_/, ""), label: l.label, amount: toNumber(l.amount) }))
      .filter((a) => a.amount !== 0);
    if (adjustments.length > 0) adjustmentsByUser[r.user_id] = adjustments;
  }
  return { manualNetByUser, adjustmentsByUser, commentByUser };
}

export type CalculateInput = {
  tenantId: number;
  month: string;
  actorUserId: number | null;
  role?: string;
  kpi_group_id?: number;
  include_inactive?: boolean;
  /** `false` bo‘lsa — faqat ko‘rish (DB ga yozilmaydi). */
  persist?: boolean;
};

export type CalculateOutput = {
  month: string;
  period_id: number;
  status: PayrollPeriodStatus;
  result: ReturnType<typeof computePayrollMonth>;
  persisted: boolean;
};

export async function calculateMonth(input: CalculateInput): Promise<CalculateOutput> {
  const { tenantId, month, actorUserId } = input;
  const period = await getOrInitPeriod(tenantId, month);
  if (input.persist !== false) await assertEditable(period);

  const userWhere: Prisma.UserWhereInput = { tenant_id: tenantId };
  if (!input.include_inactive) userWhere.is_active = true;
  if (input.role?.trim()) userWhere.role = input.role.trim();
  if (input.kpi_group_id != null) userWhere.kpi_group_links = { some: { kpi_group_id: input.kpi_group_id } };

  const users = await prisma.user.findMany({
    where: userWhere,
    select: { id: true, name: true, role: true, kpi_group_links: { select: { kpi_group_id: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });

  const employees: PayrollEmployee[] = users.map((u) => ({
    user_id: u.id,
    fio: u.name,
    role: u.role,
    kpi_group_ids: u.kpi_group_links.map((l) => l.kpi_group_id)
  }));

  const [formulas, assignments, metrics, existing] = await Promise.all([
    getFormulaForEngine(tenantId, { month }),
    listAssignments(tenantId, {}),
    collectPayrollMetrics({ tenantId, month, employees }),
    prisma.payrollEntry.findMany({
      where: { tenant_id: tenantId, period_id: period.id },
      select: { user_id: true, manual_net: true, breakdown: true, comment: true }
    })
  ]);

  const manual = readManualState(existing);
  const baseOverrideByUser: Record<number, number | null> = {};
  for (const a of assignments) {
    if (a.base_amount != null) baseOverrideByUser[a.user_id] = a.base_amount;
  }

  const result = computePayrollMonth({
    month,
    employees,
    formulas,
    metricsByUser: metrics,
    adjustmentsByUser: manual.adjustmentsByUser,
    baseOverrideByUser,
    manualNetByUser: manual.manualNetByUser
  });

  if (input.persist === false) {
    return { month, period_id: period.id, status: period.status, result, persisted: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollEntry.deleteMany({ where: { tenant_id: tenantId, period_id: period.id } });
    if (result.rows.length > 0) {
      await tx.payrollEntry.createMany({
        data: result.rows.map((r) => entryToRow(tenantId, period.id, r, metrics[r.user_id], manual.commentByUser[r.user_id]))
      });
    }
    await tx.payrollPeriod.update({
      where: { id: period.id },
      data: {
        status: period.status === "draft" ? "calculated" : period.status,
        calculated_at: new Date(),
        calculated_by: actorUserId,
        total_amount: result.totals.net_amount
      }
    });
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_period",
    entityId: period.id,
    action: "calculate",
    payload: { month, employees: result.totals.employees, total: result.totals.net_amount }
  });

  return { month, period_id: period.id, status: period.status === "draft" ? "calculated" : period.status, result, persisted: true };
}

export async function setPeriodStatus(
  tenantId: number,
  periodId: number,
  status: "approved" | "locked" | "draft",
  actorUserId: number | null
): Promise<void> {
  const period = await prisma.payrollPeriod.findFirst({ where: { tenant_id: tenantId, id: periodId } });
  if (!period) throw new Error("NOT_FOUND");
  if (period.status === "locked" && status !== "draft") throw new Error("PERIOD_LOCKED");

  const data: Prisma.PayrollPeriodUpdateInput = { status };
  if (status === "approved") {
    data.approved_at = new Date();
    data.approved_by = actorUserId;
    data.total_amount = await sumPeriodNet(tenantId, periodId);
  }
  if (status === "locked") {
    data.locked_at = new Date();
    data.locked_by = actorUserId;
  }
  await prisma.payrollPeriod.update({ where: { id: periodId }, data });

  // «Табель» bilan integratsiya: bloklangan oyda davomat tahrirlanmaydi.
  if (status === "locked") {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;
    const ts = (settings.timesheet ?? {}) as Record<string, unknown>;
    const locked = new Set(Array.isArray(ts.locked_months) ? (ts.locked_months as string[]) : []);
    locked.add(period.month);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: { ...settings, timesheet: { ...ts, locked_months: [...locked] } } as Prisma.InputJsonValue
      }
    });
  }

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_period",
    entityId: periodId,
    action: `status.${status}`,
    payload: { month: period.month, from: period.status, to: status }
  });
}
