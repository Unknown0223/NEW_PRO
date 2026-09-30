import { prisma } from "../../config/database";
import { listCalendarWorkingDays, listMonthDays, tenantMonthRangeUtc, ymdInTimeZone } from "../../lib/workday-calendar";
import { parseWorkdaysState, type WorkdaysState } from "../tabel/workdays.service";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { defaultTimesheetDay, employmentYmd, visitDayKeys } from "../timesheet/timesheet.day-status";
import { parseTimesheetState } from "../timesheet/timesheet.service";
import { computeUserMonthFact } from "./payroll-kpi-fact";
import { computeUserMonthPlan } from "./payroll-slot-plan";
import { parseItemAmounts } from "./payroll.item-amounts.pure";
import type { PayrollCalcInputs } from "./payroll.formula-vars";

export type TenantPayrollEnv = {
  timeZone: string;
  workdays: WorkdaysState;
  timesheet: ReturnType<typeof parseTimesheetState>;
};

export async function loadTenantPayrollEnv(tenantId: number): Promise<TenantPayrollEnv> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = t?.settings ?? {};
  return {
    timeZone: loadTimezoneFromSettingsJson(settings),
    workdays: parseWorkdaysState(settings),
    timesheet: parseTimesheetState(settings)
  };
}

export type PayrollUserSnapshot = {
  id: number;
  role: string;
  position: string | null;
  branch: string | null;
  trade_direction_id: number | null;
  is_active: boolean;
  hired_at: Date | null;
  dismissed_at: Date | null;
};

export type AttendanceSummary = {
  plan_days: number;
  worked: number;
  vacation: number;
  sick: number;
  trip: number;
  absent: number;
  half: number;
};

/** Tabel: qo'lda belgilangan kun ustun, aks holda grafik/GPS default. Kelajak kunlar hisoblanmaydi. */
export async function computeUserAttendance(
  tenantId: number,
  user: PayrollUserSnapshot,
  year: number,
  month: number,
  env: TenantPayrollEnv
): Promise<AttendanceSummary> {
  const { from, to } = tenantMonthRangeUtc(year, month, env.timeZone);
  const today = ymdInTimeZone(new Date(), env.timeZone);
  const visits =
    user.role === "agent"
      ? await prisma.agentVisit.findMany({
          where: { tenant_id: tenantId, agent_id: user.id, checked_in_at: { gte: from, lt: to } },
          select: { agent_id: true, checked_in_at: true }
        })
      : [];
  const visitKeys = visitDayKeys(visits, env.timeZone);
  const hiredYmd = employmentYmd(user.hired_at, env.timeZone);
  const dismissedYmd = employmentYmd(user.dismissed_at, env.timeZone);
  const s: AttendanceSummary = {
    plan_days: listCalendarWorkingDays(env.workdays, user.role, user.id, year, month).length,
    worked: 0,
    vacation: 0,
    sick: 0,
    trip: 0,
    absent: 0,
    half: 0
  };
  for (const ymd of listMonthDays(year, month)) {
    if (ymd > today) break;
    const key = `${user.id}:${ymd}`;
    const override = env.timesheet.overrides[key];
    const status =
      override?.status ??
      defaultTimesheetDay({
        state: env.workdays,
        role: user.role,
        userId: user.id,
        ymd,
        hasGpsVisit: visitKeys.has(key),
        hiredYmd,
        dismissedYmd
      }).status;
    if (status === "worked") s.worked += 1;
    else if (status === "half_day") {
      s.worked += 0.5;
      s.half += 1;
    } else if (status === "vacation") s.vacation += 1;
    else if (status === "sick") s.sick += 1;
    else if (status === "trip") s.trip += 1;
    else if (status === "absent") s.absent += 1;
  }
  return s;
}

export type BaseSalaryInfo = {
  base_full: number;
  currency: string;
  cash_desk_id: number | null;
  item_parts: Map<number, number>;
};

export async function resolveBaseSalary(tenantId: number, userId: number, role: string): Promise<BaseSalaryInfo> {
  const [emp, rc] = await Promise.all([
    prisma.payrollEmployeeConfig.findUnique({ where: { tenant_id_user_id: { tenant_id: tenantId, user_id: userId } } }),
    prisma.payrollRoleConfig.findUnique({ where: { tenant_id_role: { tenant_id: tenantId, role } } })
  ]);
  const base = emp?.base_amount != null ? Number(emp.base_amount) : rc ? Number(rc.base_amount) : 0;
  const parts = parseItemAmounts(emp?.item_amounts);
  return {
    base_full: base,
    currency: emp?.currency || rc?.currency || "UZS",
    cash_desk_id: emp?.cash_desk_id ?? null,
    item_parts: new Map(Object.entries(parts).map(([k, v]) => [Number(k), v]))
  };
}

export async function sumPaidAdvances(tenantId: number, userId: number, year: number, month: number): Promise<number> {
  const agg = await prisma.payrollPayout.aggregate({
    where: { tenant_id: tenantId, user_id: userId, year, month, kind: "advance", status: "paid" },
    _sum: { amount_uzs: true }
  });
  return Number(agg._sum.amount_uzs ?? 0);
}

export type LoadedPayrollInputs = {
  inputs: PayrollCalcInputs;
  base: BaseSalaryInfo;
  attendance: AttendanceSummary;
  plan_meta: { slots: unknown[]; warnings: string[]; pending_plans: number };
  fact_meta: { unallocated_returns: number; multi_group_products: number; slot_ids: number[] };
};

export async function loadPayrollInputs(
  tenantId: number,
  user: PayrollUserSnapshot,
  year: number,
  month: number,
  env: TenantPayrollEnv,
  productGroups?: Map<number, number[]>
): Promise<LoadedPayrollInputs> {
  const range = tenantMonthRangeUtc(year, month, env.timeZone);
  const [attendance, base, fact, plan, advances] = await Promise.all([
    computeUserAttendance(tenantId, user, year, month, env),
    resolveBaseSalary(tenantId, user.id, user.role),
    computeUserMonthFact(tenantId, user.id, user.role, range, productGroups),
    computeUserMonthPlan(tenantId, user.id, year, month, range, env.timeZone, env.workdays),
    sumPaidAdvances(tenantId, user.id, year, month)
  ]);
  const worked = Math.min(attendance.worked, attendance.plan_days);
  const baseSalary =
    attendance.plan_days > 0 ? Math.round(((base.base_full * worked) / attendance.plan_days) * 100) / 100 : 0;
  const inputs: PayrollCalcInputs = {
    base_full: base.base_full,
    base_salary: baseSalary,
    plan_days: attendance.plan_days,
    worked_days: attendance.worked,
    vacation_days: attendance.vacation,
    sick_days: attendance.sick,
    trip_days: attendance.trip,
    absent_days: attendance.absent,
    half_days: attendance.half,
    fact_total: fact.agent.total,
    fact_by_group: fact.agent.byGroup,
    returned_sum: fact.agent.returned_sum,
    plan_total: plan.total,
    plan_by_group: plan.byGroup,
    expeditor: fact.expeditor,
    team_total: fact.team?.total ?? null,
    team_by_group: fact.team?.byGroup ?? null,
    advances_paid: advances,
    item_parts: base.item_parts
  };
  return {
    inputs,
    base,
    attendance,
    plan_meta: { slots: plan.slots, warnings: plan.warnings, pending_plans: plan.pending_plans },
    fact_meta: { ...fact.diagnostics, slot_ids: [...fact.bySlot.keys()] }
  };
}

/** Deterministik JSON (Map → sorted entries) — `inputs_hash` uchun. */
export function stableInputsJson(inputs: PayrollCalcInputs): string {
  const norm = (v: unknown): unknown => {
    if (v instanceof Map) return [...v.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, x]) => [k, norm(x)]);
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return JSON.stringify(norm(inputs));
}
