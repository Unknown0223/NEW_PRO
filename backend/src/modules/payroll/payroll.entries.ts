/**
 * ЗАРПЛАТА — hisob satrlari: ro‘yxat, qo‘lda tuzatish.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { assertEditable, getOrInitPeriod, type PayrollPeriodRow } from "./payroll.period";
import { sumPeriodNet } from "./payroll.entry-row";
import { sumAmounts, toNumber } from "./payroll.money";
import type {
  PayrollAdjustment,
  PayrollBreakdownLine,
  PayrollEntryResult
} from "./payroll.types";

export type PayrollEntryRow = PayrollEntryResult & {
  id: number;
  fio: string;
  role: string;
  status: string;
  comment: string | null;
  paid_amount: number;
  metrics: Record<string, number>;
};

export async function listEntries(
  tenantId: number,
  month: string,
  q?: { role?: string; user_id?: number }
): Promise<{ period: PayrollPeriodRow; rows: PayrollEntryRow[] }> {
  const period = await getOrInitPeriod(tenantId, month);
  const where: Prisma.PayrollEntryWhereInput = { tenant_id: tenantId, period_id: period.id };
  if (q?.user_id != null) where.user_id = q.user_id;
  if (q?.role?.trim()) where.user = { role: q.role.trim() };

  const [rows, payments] = await Promise.all([
    prisma.payrollEntry.findMany({
      where,
      orderBy: { user_id: "asc" },
      include: {
        user: { select: { id: true, name: true, role: true } },
        formula: { select: { id: true, name: true } }
      }
    }),
    prisma.payrollPayment.findMany({
      where: { tenant_id: tenantId, period_id: period.id, voided_at: null },
      select: { user_id: true, amount: true }
    })
  ]);

  const paidByUser = new Map<number, number>();
  for (const p of payments) {
    paidByUser.set(p.user_id, (paidByUser.get(p.user_id) ?? 0) + toNumber(p.amount));
  }

  return {
    period,
    rows: rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      fio: r.user.name,
      role: r.user.role,
      formula_id: r.formula_id,
      formula_name: r.formula?.name ?? null,
      kind: r.kind as PayrollEntryResult["kind"],
      kpi_group_id: r.kpi_group_id,
      base_amount: toNumber(r.base_amount),
      variable_amount: toNumber(r.variable_amount),
      allowance_amount: toNumber(r.allowance_amount),
      deduction_amount: toNumber(r.deduction_amount),
      adjustment_amount: toNumber(r.adjustment_amount),
      gross_amount: toNumber(r.gross_amount),
      net_amount: toNumber(r.net_amount),
      worked_days: toNumber(r.worked_days),
      planned_days: toNumber(r.planned_days),
      achievement_percent: r.achievement_percent == null ? null : toNumber(r.achievement_percent),
      breakdown: Array.isArray(r.breakdown) ? (r.breakdown as unknown as PayrollBreakdownLine[]) : [],
      warnings: [],
      status: r.status,
      comment: r.comment,
      paid_amount: paidByUser.get(r.user_id) ?? 0,
      metrics: (r.metrics && typeof r.metrics === "object" ? r.metrics : {}) as Record<string, number>
    }))
  };
}

export async function patchEntry(
  tenantId: number,
  id: number,
  input: { manual_net?: number | null; comment?: string | null; adjustments?: PayrollAdjustment[] },
  actorUserId: number | null
): Promise<void> {
  const entry = await prisma.payrollEntry.findFirst({ where: { tenant_id: tenantId, id } });
  if (!entry) throw new Error("NOT_FOUND");
  const period = await prisma.payrollPeriod.findUnique({ where: { id: entry.period_id } });
  if (period) await assertEditable(period);

  const lines = Array.isArray(entry.breakdown) ? (entry.breakdown as unknown as PayrollBreakdownLine[]) : [];
  const kept = lines.filter((l) => !String(l?.code ?? "").startsWith("adjustment_"));

  const adjustments = input.adjustments ?? [];
  const adjustmentLines = adjustments
    .filter((a) => Number.isFinite(a.amount) && a.amount !== 0)
    .map((a) => ({ code: `adjustment_${a.code}`, label: a.label, amount: a.amount }));
  const adjustmentSum = sumAmounts(adjustmentLines.map((l) => l.amount));

  const hasManual = input.manual_net !== undefined ? input.manual_net != null : entry.manual_net != null;
  const nextAdjustment =
    input.adjustments !== undefined ? adjustmentSum : toNumber(entry.adjustment_amount);
  const nextNet =
    input.manual_net !== undefined
      ? input.manual_net
      : input.adjustments !== undefined
        ? sumAmounts([toNumber(entry.gross_amount), -toNumber(entry.deduction_amount), adjustmentSum])
        : toNumber(entry.net_amount);

  await prisma.payrollEntry.update({
    where: { id },
    data: {
      manual_net: input.manual_net === undefined ? entry.manual_net : input.manual_net,
      comment: input.comment === undefined ? entry.comment : input.comment?.trim() || null,
      adjustment_amount: nextAdjustment,
      net_amount: nextNet ?? 0,
      status: hasManual ? "manual" : "calculated",
      breakdown: [...kept, ...adjustmentLines] as Prisma.InputJsonValue,
      updated_by: actorUserId
    }
  });

  await prisma.payrollPeriod.updateMany({
    where: { tenant_id: tenantId, id: entry.period_id },
    data: { total_amount: await sumPeriodNet(tenantId, entry.period_id) }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId,
    entityType: "payroll_entry",
    entityId: id,
    action: "update",
    payload: { user_id: entry.user_id, manual_net: input.manual_net ?? null, adjustments: adjustments.length }
  });
}

