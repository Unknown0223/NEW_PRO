/**
 * Рабочие дни (Workdays) — чистая бизнес-логика графиков работы.
 *
 * Портировано из модуля «TabelERP» (agon-agent) и адаптировано под SALEC:
 *  - недельный график по ролям (role schedule);
 *  - исключения по датам (праздник / обязательный рабочий день / мероприятие / обучение);
 *  - индивидуальные графики сотрудников (override), имеющие приоритет над ролью.
 *
 * Приоритет разрешения (побеждает верхний):
 *   1. Исключение (holiday/forced/...) на конкретную дату
 *   2. Индивидуальный график сотрудника (override)
 *   3. Недельный график роли
 */

/** Роли, для которых настраивается недельный график (ключи графика). */
export const WD_ROLES = [
  "Агент",
  "Кассир",
  "Менеджер",
  "Мерчендайзер",
  "Оператор",
  "Складчик",
  "Супервайзер",
  "Экспедитор"
] as const;
export type WdRole = (typeof WD_ROLES)[number];

/** Метки дней недели (понедельник первый). */
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const WEEKDAYS_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье"
] as const;

export const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь"
] as const;

/** График: 7 булевых значений, понедельник первый. */
export type Schedule = boolean[];
export type ScheduleMap = Record<WdRole, Schedule>;

/** График по умолчанию: Пн–Сб рабочие, Вс выходной (супервайзер — Пн–Пт). */
export const DEFAULT_SCHEDULES: ScheduleMap = {
  Агент: [true, true, true, true, true, true, false],
  Кассир: [true, true, true, true, true, true, false],
  Менеджер: [true, true, true, true, true, true, false],
  Мерчендайзер: [true, true, true, true, true, true, false],
  Оператор: [true, true, true, true, true, true, false],
  Складчик: [true, true, true, true, true, true, false],
  Супервайзер: [true, true, true, true, true, false, false],
  Экспедитор: [true, true, true, true, true, true, false]
};

export type ExceptionType = "holiday" | "forced" | "event" | "training";

export const EXCEPTION_META: Record<
  ExceptionType,
  { label: string; desc: string; color: string; badgeClass: string; makesWorkday: boolean }
> = {
  holiday: {
    label: "Праздник",
    desc: "Рабочий день → становится выходным",
    color: "#f43f5e",
    badgeClass: "bg-rose-500 text-white",
    makesWorkday: false
  },
  forced: {
    label: "Обязательный рабочий день",
    desc: "Выходной → становится рабочим днём",
    color: "#0e8c7a",
    badgeClass: "bg-emerald-600 text-white",
    makesWorkday: true
  },
  event: {
    label: "Мероприятие компании",
    desc: "День мероприятия — посещаемость не требуется",
    color: "#3b82f6",
    badgeClass: "bg-blue-500 text-white",
    makesWorkday: false
  },
  training: {
    label: "Обучение (тренинг)",
    desc: "День обучения считается рабочим днём",
    color: "#a855f7",
    badgeClass: "bg-purple-500 text-white",
    makesWorkday: true
  }
};

export interface WorkdayException {
  id: string;
  role: WdRole | "ALL";
  date: string; // YYYY-MM-DD
  type: ExceptionType;
  comment: string;
  createdBy: string;
  createdAt: string;
}

/** Индивидуальный график сотрудника (полностью заменяет график роли). */
export interface EmployeeOverride {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  position: string; // сопоставляется с WdRole
  schedule: Schedule; // понедельник первый, 7 булевых
  comment: string;
  createdBy: string;
  createdAt: string;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function dateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month 1-12
}

/** Индекс дня недели, понедельник первый (0=Пн ... 6=Вс). */
export function weekdayIndex(year: number, month: number, day: number): number {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

export function resolveSchedule(
  position: string,
  roleSchedules: ScheduleMap,
  overrides: EmployeeOverride[],
  employeeId?: string
): Schedule {
  if (employeeId) {
    const ov = overrides.find((o) => o.employeeId === employeeId);
    if (ov) return ov.schedule;
  }
  return roleSchedules[position as WdRole] ?? [true, true, true, true, true, true, false];
}

export function isWorkdayFor(
  position: string,
  roleSchedules: ScheduleMap,
  overrides: EmployeeOverride[],
  exceptions: WorkdayException[],
  employeeId: string | undefined,
  year: number,
  month: number,
  day: number
): boolean {
  const ds = dateStr(year, month, day);
  const ex = exceptions.find((e) => e.date === ds && (e.role === (position as WdRole) || e.role === "ALL"));
  if (ex) return EXCEPTION_META[ex.type].makesWorkday;
  const sch = resolveSchedule(position, roleSchedules, overrides, employeeId);
  return sch[weekdayIndex(year, month, day)];
}

export function monthWorkdayCountFor(
  position: string,
  roleSchedules: ScheduleMap,
  overrides: EmployeeOverride[],
  exceptions: WorkdayException[],
  employeeId: string | undefined,
  year: number,
  month: number
): number {
  const dim = daysInMonth(year, month);
  let c = 0;
  for (let d = 1; d <= dim; d++) {
    if (isWorkdayFor(position, roleSchedules, overrides, exceptions, employeeId, year, month, d)) c++;
  }
  return c;
}

export const scheduleDiff = (a: Schedule, b: Schedule): boolean[] => a.map((v, i) => v !== b[i]);

export const cloneSchedules = (s: ScheduleMap): ScheduleMap =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, [...v]])) as ScheduleMap;

export const countWorkdays = (s: Schedule): number => s.filter(Boolean).length;

/** Рабочих дней роли в месяце с учётом исключений. */
export function monthWorkdayCount(
  schedule: Schedule,
  exceptions: WorkdayException[],
  role: WdRole,
  year: number,
  month: number
): number {
  const dim = daysInMonth(year, month);
  let count = 0;
  for (let d = 1; d <= dim; d++) {
    const ds = dateStr(year, month, d);
    let working = schedule[weekdayIndex(year, month, d)];
    const ex = exceptions.find((e) => e.date === ds && (e.role === role || e.role === "ALL"));
    if (ex) working = EXCEPTION_META[ex.type].makesWorkday;
    if (working) count++;
  }
  return count;
}

/** Быстрые пресеты для индивидуального графика. */
export const SCHEDULE_PRESETS: { label: string; schedule: Schedule }[] = [
  { label: "Вс рабочий · Пн выходной", schedule: [false, true, true, true, true, true, true] },
  { label: "Вс рабочий · Сб выходной", schedule: [true, true, true, true, true, false, true] },
  { label: "7 дней (без выходных)", schedule: [true, true, true, true, true, true, true] },
  { label: "5 дней (Сб+Вс выходные)", schedule: [true, true, true, true, true, false, false] }
];
