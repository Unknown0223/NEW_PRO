/**
 * ЗАРПЛАТА — oylik me’yoriy ish kunlari (норма дней).
 *
 * Manba: «Рабочие дни» (`tenant.settings.workdays`, `workdays.service.ts`):
 *  - `schedules[rol]` — haftalik grafik (7 element, Dushanba = 0).
 *  - `exceptions`     — sanalar bo‘yicha istisnolar (holiday / forced / event / training).
 *  - `overrides`      — xodimga individual grafik.
 *
 * Hisob tartibi: individual grafik → rol grafigi → istisnolar bilan tuzatiladi.
 * `holiday` = ish kuni emas; `forced` = ish kuni; `event` / `training` = to‘lanadigan kun.
 */
import { daysInMonth } from "./payroll.money";

export type PlannedDayException = {
  role: string;
  date: string;
  type: "holiday" | "forced" | "event" | "training";
};

export type PlannedDayOverride = {
  employeeId: string;
  schedule: boolean[];
};

export type WorkdaysSnapshot = {
  schedules: Record<string, boolean[]>;
  exceptions: PlannedDayException[];
  overrides: PlannedDayOverride[];
};

/** `User.role` → «Рабочие дни» rol nomi. Topilmasa — Дш–Шн (6 kun). */
export const WORKDAY_ROLE_BY_USER_ROLE: Record<string, string> = {
  agent: "Агент",
  cashier: "Кассир",
  manager: "Менеджер",
  merchandiser: "Мерчендайзер",
  operator: "Оператор",
  skladchik: "Складчик",
  supervisor: "Супервайзер",
  expeditor: "Экспедитор",
  collector: "Экспедитор",
  auditor: "Мерчендайзер",
  gruzchik: "Складчик",
  storekeeper: "Складчик",
  warehouse_manager: "Складчик",
  driver: "Экспедитор",
  logist: "Оператор",
  dispatcher: "Оператор",
  accountant: "Оператор",
  director: "Менеджер",
  sales_director: "Менеджер",
  commercial_director: "Менеджер",
  regional_manager: "Менеджер"
};

const DEFAULT_SCHEDULE = [true, true, true, true, true, true, false];

/** JS `getUTCDay()`: 0 = Yakshanba → grafik indeksi (0 = Dushanba). */
function scheduleIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function workdayRoleFor(userRole: string | null | undefined): string {
  return WORKDAY_ROLE_BY_USER_ROLE[(userRole ?? "").trim()] ?? "Складчик";
}

/**
 * Oy uchun me’yoriy ish kunlari.
 * `planned_days` = 0 bo‘lsa, hisob engine davomat koeffitsiyentini 1 deb oladi.
 */
export function plannedWorkdays(input: {
  snapshot: WorkdaysSnapshot | null;
  month: string;
  userRole: string;
  userId?: number;
}): number {
  const { snapshot, month } = input;
  const total = daysInMonth(month);
  if (!/^\d{4}-\d{2}$/.test(month)) return 0;

  const roleKey = workdayRoleFor(input.userRole);
  const roleSchedule = snapshot?.schedules?.[roleKey] ?? DEFAULT_SCHEDULE;
  const override = snapshot?.overrides?.find((o) => String(o.employeeId) === String(input.userId ?? ""));
  const schedule = override?.schedule?.length === 7 ? override.schedule : roleSchedule;

  const exceptionByDate = new Map<string, PlannedDayException>();
  for (const e of snapshot?.exceptions ?? []) {
    // Rolga tegishli yoki «ALL» istisnolar
    if (e.role !== "ALL" && e.role !== roleKey) continue;
    exceptionByDate.set(e.date, e);
  }

  let count = 0;
  for (let day = 1; day <= total; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const jsDay = new Date(`${date}T00:00:00.000Z`).getUTCDay();
    let working = schedule[scheduleIndex(jsDay)] !== false;

    const ex = exceptionByDate.get(date);
    if (ex) {
      if (ex.type === "holiday") working = false;
      else working = true; // forced | event | training — to‘lanadigan kun
    }
    if (working) count += 1;
  }
  return count;
}
