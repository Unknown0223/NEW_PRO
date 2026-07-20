import type { WorkdaysState, Schedule } from "../tabel/workdays.service";
import { getWorkdaysState } from "../tabel/workdays.service";

const AGENT_ROLE = "Агент";

/** Frontend `weekdayIndex` bilan bir xil: 0=Пн … 6=Вс. */
function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

function scheduleHasWorkday(sch: Schedule | null | undefined): boolean {
  return Array.isArray(sch) && sch.length === 7 && sch.some(Boolean);
}

function roleSchedule(state: WorkdaysState): Schedule {
  const s = state.schedules[AGENT_ROLE];
  if (scheduleHasWorkday(s)) return s;
  return [true, true, true, true, true, true, false];
}

/**
 * Override faqat haqiqiy ish kunlari bo‘lsa qo‘llanadi.
 * Bo‘sh/noto‘g‘ri individual grafik → rol grafigiga qaytish
 * (aks holda 0 ish kuni chiqib, kunlik plan 0 bo‘ladi).
 */
function resolveAgentSchedule(state: WorkdaysState, employeeId?: string | number | null): Schedule {
  const id = employeeId != null ? String(employeeId).trim() : "";
  if (id) {
    const ov = state.overrides.find((o) => String(o.employeeId) === id);
    if (ov && scheduleHasWorkday(ov.schedule)) return ov.schedule;
  }
  return roleSchedule(state);
}

/** Exception meta — frontend `EXCEPTION_META.makesWorkday` bilan bir xil. */
function exceptionMakesWorkday(type: string): boolean | null {
  if (type === "holiday" || type === "event") return false;
  if (type === "forced" || type === "training") return true;
  return null;
}

/**
 * Sana agent uchun ish kuni mi? (web «Рабочие дни» bilan bir xil ustuvorlik).
 */
export function isAgentWorkingDay(
  state: WorkdaysState,
  ymd: string,
  employeeId?: string | number | null
): boolean {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  const roleExceptions = state.exceptions.filter(
    (e) => e.date === ymd && (e.role === "ALL" || e.role === AGENT_ROLE)
  );
  if (roleExceptions.length > 0) {
    const makes = exceptionMakesWorkday(roleExceptions[0]!.type);
    if (makes != null) return makes;
  }
  const schedule = resolveAgentSchedule(state, employeeId);
  return Boolean(schedule[weekdayIndex(y, m, d)]);
}

/** Oy ichidagi agent ish kunlari (YYYY-MM-DD). */
export function listAgentWorkingDaysInMonth(
  state: WorkdaysState,
  year: number,
  monthNum: number,
  employeeId?: string | number | null
): string[] {
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const out: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (isAgentWorkingDay(state, ymd, employeeId)) out.push(ymd);
  }
  // Oxirgi himoya: hech narsa topilmasa — Пн–Сб default.
  if (out.length === 0) {
    const fallback: Schedule = [true, true, true, true, true, true, false];
    for (let d = 1; d <= daysInMonth; d++) {
      if (fallback[weekdayIndex(year, monthNum, d)]) {
        out.push(`${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
      }
    }
  }
  return out;
}

export type KpiDayRouteRow = {
  date: string;
  is_working_day: boolean;
  is_today: boolean;
  is_future: boolean;
  plan_sum: number;
  fact_sum: number;
  execution_pct: number | null;
  remaining_sum: number;
  /** fact − plan (agar pereplan). */
  over_sum: number;
  carry_in: number;
  status: "done" | "over" | "warn" | "pending" | "off";
};

export type KpiDailyRoutePlan = {
  working_days_total: number;
  remaining_working_days: number;
  past_working_days: number;
  base_day_plan: number;
  today_plan_sum: number;
  fact_before_today: number;
  month_remaining_before_today: number;
  /** O‘tgan kunlardan kelgan yetishmovchilik (teng taqsimlanadi). */
  carry_forward_sum: number;
  /** O‘tgan kunlarda rejadən ortiq (qolgan kunlik plan kamayadi). */
  surplus_sum: number;
  vs_yesterday_pct: number | null;
  days: KpiDayRouteRow[];
};

function pct(plan: number, fact: number): number | null {
  if (plan <= 0) return fact > 0 ? 100 : null;
  return Math.round((fact / plan) * 1000) / 10;
}

/**
 * Kunlik plan:
 * - baza = oylik / ish kunlari (teng);
 * - bugun+kelajak = (oylik − bugungacha fact) / qolgan ish kunlari
 *   (yetishmovchilik ham, pereplan ham shu yerda teng taqsimlanadi);
 * - o‘tgan kun = o‘sha ertalabdagi reja (tarixiy).
 */
export function buildKpiDailyRoutePlan(opts: {
  monthPlan: number;
  year: number;
  monthNum: number;
  todayKey: string;
  salesByDate: Map<string, number>;
  workingDays: string[];
}): KpiDailyRoutePlan {
  const { monthPlan, year, monthNum, todayKey, salesByDate, workingDays } = opts;
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();
  const workSet = new Set(workingDays);
  const workingDaysTotal = workingDays.length;
  const baseDayPlan = workingDaysTotal > 0 ? monthPlan / workingDaysTotal : 0;

  const remainingWorkingDays = workingDays.filter((d) => d >= todayKey).length;
  const pastWorkingDays = workingDays.filter((d) => d < todayKey).length;

  let factBeforeToday = 0;
  const monthPrefix = `${year}-${String(monthNum).padStart(2, "0")}-`;
  for (const [d, s] of salesByDate) {
    if (d.startsWith(monthPrefix) && d < todayKey) factBeforeToday += s;
  }

  // Qolgan oy rejasi: oshiq bajarish → kamayadi (0 gacha).
  const monthRemainingBeforeToday = Math.max(0, monthPlan - factBeforeToday);
  // Bugun + kelajak — BIR XIL kunlik ulush (ko‘payib ketmasligi kerak).
  const todayPlanSum =
    remainingWorkingDays > 0 ? monthRemainingBeforeToday / remainingWorkingDays : 0;

  const expectedByNow = baseDayPlan * pastWorkingDays;
  const carryForwardSum = Math.max(0, expectedByNow - factBeforeToday);
  const surplusSum = Math.max(0, factBeforeToday - expectedByNow);

  const yesterdayKey = (() => {
    const [y, m, d] = todayKey.split("-").map((x) => Number.parseInt(x, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  })();
  const yesterdaySales = salesByDate.get(yesterdayKey) ?? 0;
  let vsYesterdayPct: number | null = null;
  if (baseDayPlan > 0 && workSet.has(yesterdayKey)) {
    const yFactBefore = factBeforeToday - yesterdaySales;
    const yRemainingDays = workingDays.filter((d) => d >= yesterdayKey).length;
    const yPlan =
      yRemainingDays > 0 ? Math.max(0, monthPlan - yFactBefore) / yRemainingDays : baseDayPlan;
    if (yPlan > 0) {
      const yPct = (yesterdaySales / yPlan) * 100;
      const tPct = todayPlanSum > 0 ? ((salesByDate.get(todayKey) ?? 0) / todayPlanSum) * 100 : 0;
      vsYesterdayPct = Math.round((tPct - yPct) * 10) / 10;
    }
  }

  const days: KpiDayRouteRow[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isWork = workSet.has(ymd);
    const isToday = ymd === todayKey;
    const isFuture = ymd > todayKey;
    const fact = salesByDate.get(ymd) ?? 0;

    if (!isWork) {
      days.push({
        date: ymd,
        is_working_day: false,
        is_today: isToday,
        is_future: isFuture,
        plan_sum: 0,
        fact_sum: fact,
        execution_pct: null,
        remaining_sum: 0,
        over_sum: 0,
        carry_in: 0,
        status: "off"
      });
      continue;
    }

    let factBefore = 0;
    for (const [sd, s] of salesByDate) {
      if (sd.startsWith(monthPrefix) && sd < ymd) factBefore += s;
    }

    let planSum: number;
    let carryIn: number;
    if (isToday || isFuture) {
      // Qolgan barcha ish kunlari — teng ulush (yetishmovchilik / pereplan allaqachon ichida).
      planSum = todayPlanSum;
      carryIn = isToday ? carryForwardSum : 0;
    } else {
      // O‘tgan kun: o‘sha kundagi ertalabgi reja.
      const daysLeftThen = workingDays.filter((x) => x >= ymd).length;
      planSum = daysLeftThen > 0 ? Math.max(0, monthPlan - factBefore) / daysLeftThen : 0;
      const expectedPast = baseDayPlan * workingDays.filter((x) => x < ymd).length;
      carryIn = Math.max(0, expectedPast - factBefore);
    }

    const exec = pct(planSum, fact);
    const remaining = Math.max(0, planSum - fact);
    const overSum = Math.max(0, fact - planSum);

    let status: KpiDayRouteRow["status"] = "pending";
    if (isFuture) status = "pending";
    else if (overSum > 0) status = "over";
    else if (exec == null) status = fact > 0 ? "done" : "pending";
    else if (exec >= 100) status = "done";
    else if (fact > 0) status = "warn";
    else status = "warn";

    days.push({
      date: ymd,
      is_working_day: true,
      is_today: isToday,
      is_future: isFuture,
      plan_sum: planSum,
      fact_sum: fact,
      execution_pct: isFuture && fact <= 0 ? null : exec,
      remaining_sum: remaining,
      over_sum: overSum,
      carry_in: carryIn,
      status: isFuture && fact <= 0 ? "pending" : status
    });
  }

  return {
    working_days_total: workingDaysTotal,
    remaining_working_days: remainingWorkingDays,
    past_working_days: pastWorkingDays,
    base_day_plan: baseDayPlan,
    today_plan_sum: todayPlanSum,
    fact_before_today: factBeforeToday,
    month_remaining_before_today: monthRemainingBeforeToday,
    carry_forward_sum: carryForwardSum,
    surplus_sum: surplusSum,
    vs_yesterday_pct: vsYesterdayPct,
    days
  };
}

export async function loadAgentWorkingDays(
  tenantId: number,
  userId: number,
  year: number,
  monthNum: number
): Promise<string[]> {
  try {
    const state = await getWorkdaysState(tenantId);
    return listAgentWorkingDaysInMonth(state, year, monthNum, userId);
  } catch {
    // Tenant settings yo‘q — Пн–Сб.
    const empty = parseFallbackState();
    return listAgentWorkingDaysInMonth(empty, year, monthNum, null);
  }
}

function parseFallbackState(): WorkdaysState {
  return {
    schedules: {
      Агент: [true, true, true, true, true, true, false],
      Кассир: [true, true, true, true, true, true, false],
      Менеджер: [true, true, true, true, true, true, false],
      Мерчендайзер: [true, true, true, true, true, true, false],
      Оператор: [true, true, true, true, true, true, false],
      Складчик: [true, true, true, true, true, true, false],
      Супервайзер: [true, true, true, true, true, false, false],
      Экспедитор: [true, true, true, true, true, true, false]
    },
    exceptions: [],
    overrides: []
  };
}
