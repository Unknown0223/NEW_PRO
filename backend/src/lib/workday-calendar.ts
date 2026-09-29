/**
 * Yagona ish kuni kalendari — tabel default, payroll rejadagi kunlar va mobil KPI
 * bir xil qoidadan foydalanadi.
 *
 * Ustuvorlik: rolga xos istisno → «Все роли» istisno → individual grafik →
 * rol grafigi → «По умолчанию» (Пн–Сб). Kun kalitlari `YYYY-MM-DD` (tenant mahalliy sanasi).
 */
import type { ExceptionType, Schedule, WdRole, WorkdaysState } from "../modules/tabel/workdays.service";

export const DEFAULT_WORK_SCHEDULE: Schedule = [true, true, true, true, true, true, false];

/** `users.role` → «Рабочие дни» roli. Ro'yxatda yo'q rollar default grafikni oladi. */
export const USER_ROLE_TO_CALENDAR_ROLE: Record<string, WdRole> = {
  agent: "Агент",
  cashier: "Кассир",
  manager: "Менеджер",
  merchandiser: "Мерчендайзер",
  operator: "Оператор",
  skladchik: "Складчик",
  supervisor: "Супервайзер",
  expeditor: "Экспедитор"
};

export type WorkdayDecision = {
  working: boolean;
  reason: "exception" | "override" | "role_schedule" | "default";
  exceptionType?: ExceptionType;
};

function hasWorkday(s: Schedule | undefined | null): s is Schedule {
  return Array.isArray(s) && s.length === 7 && s.some(Boolean);
}

/** 0 = Dushanba … 6 = Yakshanba. */
export function weekdayIndexOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  return (new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay() + 6) % 7;
}

export function decideCalendarDay(
  state: WorkdaysState,
  userRole: string | null | undefined,
  userId: number | string | null | undefined,
  ymd: string
): WorkdayDecision {
  const wdRole = userRole ? USER_ROLE_TO_CALENDAR_ROLE[userRole] : undefined;
  const ex =
    (wdRole ? state.exceptions.find((e) => e.date === ymd && e.role === wdRole) : undefined) ??
    state.exceptions.find((e) => e.date === ymd && e.role === "ALL");
  if (ex) {
    return { working: ex.type === "forced" || ex.type === "training", reason: "exception", exceptionType: ex.type };
  }
  const wd = weekdayIndexOfYmd(ymd);
  if (userId != null) {
    const override = state.overrides.find((o) => String(o.employeeId) === String(userId));
    if (hasWorkday(override?.schedule)) return { working: Boolean(override!.schedule[wd]), reason: "override" };
  }
  const roleSchedule = wdRole ? state.schedules[wdRole] : undefined;
  if (hasWorkday(roleSchedule)) return { working: Boolean(roleSchedule[wd]), reason: "role_schedule" };
  return { working: Boolean(DEFAULT_WORK_SCHEDULE[wd]), reason: "default" };
}

export function isCalendarWorkingDay(
  state: WorkdaysState,
  userRole: string | null | undefined,
  userId: number | string | null | undefined,
  ymd: string
): boolean {
  return decideCalendarDay(state, userRole, userId, ymd).working;
}

export function ymdOf(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function listMonthDays(year: number, month: number): string[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => ymdOf(year, month, i + 1));
}

export function listCalendarWorkingDays(
  state: WorkdaysState,
  userRole: string | null | undefined,
  userId: number | string | null | undefined,
  year: number,
  month: number
): string[] {
  return listMonthDays(year, month).filter((d) => isCalendarWorkingDay(state, userRole, userId, d));
}

/** Instant → tenant mahalliy `YYYY-MM-DD`. */
export function ymdInTimeZone(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Tenant mahalliy devor soati → UTC instant (DST uchun iterativ tuzatish). */
export function utcInstantForLocalMidnight(ymd: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => Number.parseInt(x, 10));
  let guess = Date.UTC(y!, m! - 1, d!, 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(guess));
    const g = (t: string) => Number(local.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"));
    const diff = asUtc - guess;
    const target = Date.UTC(y!, m! - 1, d!, 0, 0, 0) - diff;
    if (target === guess) break;
    guess = target;
  }
  return new Date(guess);
}

/** Tenant oyining [start, end) oralig'i UTC da. */
export function tenantMonthRangeUtc(year: number, month: number, timeZone: string): { from: Date; to: Date } {
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  return {
    from: utcInstantForLocalMidnight(ymdOf(year, month, 1), timeZone),
    to: utcInstantForLocalMidnight(ymdOf(nextY, nextM, 1), timeZone)
  };
}

export function parseYearMonth(month: string): { year: number; month: number } {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("BAD_MONTH");
  const [y, m] = month.split("-").map((x) => Number.parseInt(x, 10));
  if (!y || !m || m < 1 || m > 12) throw new Error("BAD_MONTH");
  return { year: y, month: m };
}
