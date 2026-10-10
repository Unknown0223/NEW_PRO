/**
 * ЗАРПЛАТА — hisob satrini Prisma yozuviga aylantirish va davr summasi.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { sumAmounts, toNumber } from "./payroll.money";
import type { PayrollEntryResult } from "./payroll.types";

export function entryToRow(
  tenantId: number,
  periodId: number,
  r: PayrollEntryResult,
  metrics: unknown,
  comment?: string
) {
  return {
    tenant_id: tenantId,
    period_id: periodId,
    user_id: r.user_id,
    formula_id: r.formula_id,
    kpi_group_id: r.kpi_group_id,
    kind: r.kind,
    base_amount: r.base_amount,
    variable_amount: r.variable_amount,
    allowance_amount: r.allowance_amount,
    deduction_amount: r.deduction_amount,
    adjustment_amount: r.adjustment_amount,
    gross_amount: r.gross_amount,
    net_amount: r.net_amount,
    worked_days: r.worked_days,
    planned_days: r.planned_days,
    achievement_percent: r.achievement_percent,
    metrics: (metrics ?? {}) as Prisma.InputJsonValue,
    breakdown: [...r.breakdown, ...r.warnings.map((w, i) => ({ code: `warning_${i}`, label: w, amount: 0 }))] as Prisma.InputJsonValue,
    comment: comment ?? null
  };
}


export async function sumPeriodNet(tenantId: number, periodId: number): Promise<number> {
  const rows = await prisma.payrollEntry.findMany({
    where: { tenant_id: tenantId, period_id: periodId },
    select: { net_amount: true }
  });
  return sumAmounts(rows.map((r) => toNumber(r.net_amount)));
}
