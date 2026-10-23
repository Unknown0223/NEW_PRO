import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { listCalendarWorkingDays, listMonthDays, tenantMonthRangeUtc, ymdInTimeZone } from "../../lib/workday-calendar";
import { parseWorkdaysState, type WorkdaysState } from "../tabel/workdays.service";
import { loadTimezoneFromSettingsJson } from "../tenant-settings/tenant-timezone";
import { defaultTimesheetDay, employmentYmd, visitDayKeys } from "../timesheet/timesheet.day-status";
import { parseTimesheetState } from "../timesheet/timesheet.service";
import { applyAgentNormForUser, loadAgentNormContext, type AgentNormContext } from "../timesheet/timesheet.agent-norm";
import type { NormDay } from "../timesheet/timesheet.agent-norm.pure";
import { computeUserMonthFact } from "./payroll-kpi-month";
import { userMonthFactFromCache, type BaseBundle, type MonthFactCache } from "./payroll.month-shared";
import { computeUserMonthPlan, type PlanMonthCache } from "./payroll-slot-plan";
import { computeTeamMonthPlan } from "./payroll-team-plan";
import { parseItemAmounts, parseKpiAmounts } from "./payroll.item-amounts.pure";
import type { PayrollCalcInputs } from "./payroll.formula-vars";

export type TenantPayrollEnv = {
  timeZone: string;
  workdays: WorkdaysState;
  timesheet: ReturnType<typeof parseTimesheetState>;
  settings: Prisma.JsonValue;
};

export async function loadTenantPayrollEnv(tenantId: number): Promise<TenantPayrollEnv> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const settings = t?.settings ?? {};
  return {
    timeZone: loadTimezoneFromSettingsJson(settings),
    workdays: parseWorkdaysState(settings),
    timesheet: parseTimesheetState(settings),
    settings
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

export type AttendancePrep = { visitKeys: Set<string>; norm: AgentNormContext };

/** Oy bo'yicha tashrif va agent normasi — barcha xodimlar uchun bir marta. */
export async function prepareAttendance(
  tenantId: number,
  users: PayrollUserSnapshot[],
  year: number,
  month: number,
  env: TenantPayrollEnv
): Promise<AttendancePrep> {
  const agents = users.filter((u) => u.role === "agent");
  const ids = agents.map((u) => u.id);
  const { from, to } = tenantMonthRangeUtc(year, month, env.timeZone);
  const [visits, flags] = await Promise.all([
    ids.length
      ? prisma.agentVisit.findMany({
          where: { tenant_id: tenantId, agent_id: { in: ids }, checked_in_at: { gte: from, lt: to } },
          select: { agent_id: true, checked_in_at: true }
        })
      : Promise.resolve([]),
    ids.length ? prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, consignment: true } }) : Promise.resolve([])
  ]);
  const consignment = new Map(flags.map((f) => [f.id, f.consignment]));
  const norm = await loadAgentNormContext(
    tenantId,
    env.settings,
    agents.map((a) => ({ id: a.id, role: a.role, consignment: consignment.get(a.id) ?? false })),
    year,
    month,
    env.timeZone
  );
  return { visitKeys: visitDayKeys(visits, env.timeZone), norm };
}

/** Tabel: qo'lda belgilangan kun ustun, aks holda grafik/GPS default. Kelajak kunlar hisoblanmaydi. */
export async function computeUserAttendance(
  tenantId: number,
  user: PayrollUserSnapshot,
  year: number,
  month: number,
  env: TenantPayrollEnv,
  prep?: AttendancePrep
): Promise<AttendanceSummary> {
  const { from, to } = tenantMonthRangeUtc(year, month, env.timeZone);
  const today = ymdInTimeZone(new Date(), env.timeZone);
  const visitKeys = prep
    ? prep.visitKeys
    : visitDayKeys(
        user.role === "agent"
          ? await prisma.agentVisit.findMany({
              where: { tenant_id: tenantId, agent_id: user.id, checked_in_at: { gte: from, lt: to } },
              select: { agent_id: true, checked_in_at: true }
            })
          : [],
        env.timeZone
      );
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
  const days: NormDay[] = listMonthDays(year, month).map((ymd) => {
    const key = `${user.id}:${ymd}`;
    const override = env.timesheet.overrides[key];
    const def = defaultTimesheetDay({
      state: env.workdays,
      role: user.role,
      userId: user.id,
      ymd,
      hasGpsVisit: visitKeys.has(key),
      hiredYmd,
      dismissedYmd
    });
    return {
      date: ymd,
      status: override?.status ?? def.status,
      source: override?.source ?? def.source,
      manual: Boolean(override),
      off_employment: def.off_employment && !override
    };
  });
  if (user.role === "agent") {
    const ctx =
      prep?.norm ??
      (await loadAgentNormContext(
        tenantId,
        env.settings,
        [
          {
            id: user.id,
            role: user.role,
            consignment: (await prisma.user.findUnique({ where: { id: user.id }, select: { consignment: true } }))?.consignment ?? false
          }
        ],
        year,
        month,
        env.timeZone
      ));
    applyAgentNormForUser(ctx, user, days, env.workdays, year, month);
  }
  for (const { date: ymd, status } of days) {
    if (ymd > today) break;
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
  kpi_amounts: Map<number, number>;
};

export async function resolveBaseSalary(
  tenantId: number,
  userId: number,
  role: string,
  year?: number,
  month?: number,
  bases?: BaseBundle
): Promise<BaseSalaryInfo> {
  const [emp, rc] = bases
    ? [bases.emp.get(userId) ?? null, bases.role.get(role) ?? null]
    : await Promise.all([
        prisma.payrollEmployeeConfig.findUnique({ where: { tenant_id_user_id: { tenant_id: tenantId, user_id: userId } } }),
        prisma.payrollRoleConfig.findUnique({ where: { tenant_id_role: { tenant_id: tenantId, role } } })
      ]);
  let base = emp?.base_amount != null ? Number(emp.base_amount) : rc ? Number(rc.base_amount) : 0;
  let parts = { ...parseItemAmounts(rc?.item_amounts), ...parseItemAmounts(emp?.item_amounts) };
  let kpiRaw: unknown = emp?.item_amounts;
  if (year && month) {
    const { gridForCalc } = await import("./payroll.grid-month");
    const snap = await gridForCalc(tenantId, userId, role, year, month, bases?.grids);
    if (snap?.scope === "user") {
      parts = snap.item_amounts;
      kpiRaw = snap.raw ?? kpiRaw;
      if (snap.base_amount != null) base = snap.base_amount;
    } else if (snap) {
      parts = { ...snap.item_amounts, ...parseItemAmounts(emp?.item_amounts) };
      if (emp?.base_amount == null && snap.base_amount != null) base = snap.base_amount;
    }
  }
  return {
    base_full: base,
    currency: emp?.currency || rc?.currency || "UZS",
    cash_desk_id: emp?.cash_desk_id ?? null,
    item_parts: new Map(Object.entries(parts).map(([k, v]) => [Number(k), v])),
    kpi_amounts: new Map(Object.entries(parseKpiAmounts(kpiRaw)).map(([k, v]) => [Number(k), v]))
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
  plan_meta: { slots: unknown[]; warnings: string[]; pending_plans: number; team_coverage: number | null };
  fact_meta: { unallocated_returns: number; multi_group_products: number; slot_ids: number[] };
};

export type PayrollInputCache = {
  facts?: MonthFactCache;
  plans?: PlanMonthCache;
  attendance?: AttendancePrep;
  bases?: BaseBundle;
  advances?: Map<number, number>;
};

export async function loadPayrollInputs(
  tenantId: number,
  user: PayrollUserSnapshot,
  year: number,
  month: number,
  env: TenantPayrollEnv,
  productGroups?: Map<number, number[]>,
  cache?: PayrollInputCache
): Promise<LoadedPayrollInputs> {
  const range = tenantMonthRangeUtc(year, month, env.timeZone);
  const [attendance, base, fact, plan, advances, teamPlan] = await Promise.all([
    computeUserAttendance(tenantId, user, year, month, env, cache?.attendance),
    resolveBaseSalary(tenantId, user.id, user.role, year, month, cache?.bases),
    cache?.facts
      ? userMonthFactFromCache(tenantId, user.id, user.role, range, cache.facts)
      : computeUserMonthFact(tenantId, user.id, user.role, range, productGroups),
    computeUserMonthPlan(tenantId, user.id, year, month, range, env.timeZone, env.workdays, cache?.plans),
    cache?.advances ? Promise.resolve(cache.advances.get(user.id) ?? 0) : sumPaidAdvances(tenantId, user.id, year, month),
    user.role === "supervisor"
      ? computeTeamMonthPlan(tenantId, user.id, year, month, range, env.timeZone, env.workdays, cache?.plans)
      : Promise.resolve(null)
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
    team_plan_total: teamPlan?.total ?? null,
    team_plan_by_group: teamPlan?.byGroup ?? null,
    advances_paid: advances,
    item_parts: base.item_parts,
    kpi_amounts: base.kpi_amounts
  };
  return {
    inputs,
    base,
    attendance,
    plan_meta: { slots: plan.slots, warnings: plan.warnings, pending_plans: plan.pending_plans, team_coverage: teamPlan?.coverage ?? null },
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
