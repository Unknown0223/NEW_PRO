import type { WorkdaysState } from "../tabel/workdays.service";
import { executionPctFromPlanFact } from "./plans.monitoring-aggregates";

export type DailyKpiDayStatus =
  | "done"
  | "over"
  | "warn"
  | "pending"
  | "off"
  | "no_plan";

export function monthBounds(year: number, month: number): {
  start: Date;
  end: Date;
  daysInMonth: number;
} {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start, end, daysInMonth };
}

export function routeAsOfKey(month: string, todayKey: string, daysInMonth: number): string {
  if (month === todayKey.slice(0, 7)) return todayKey;
  if (month < todayKey.slice(0, 7)) return `${month}-${String(daysInMonth).padStart(2, "0")}`;
  return `${month}-01`;
}

export function statusFromDay(opts: {
  hasPlans: boolean;
  todayPlan: number;
  todayFact: number;
  isWorkingToday: boolean;
}): DailyKpiDayStatus {
  if (!opts.hasPlans) return "no_plan";
  if (!opts.isWorkingToday) return "off";
  if (opts.todayPlan <= 0 && opts.todayFact <= 0) return "pending";
  if (opts.todayFact > opts.todayPlan && opts.todayPlan > 0) return "over";
  const pct = executionPctFromPlanFact(opts.todayPlan, opts.todayFact);
  if (pct != null && pct >= 100) return "done";
  if (opts.todayFact > 0) return "warn";
  return "pending";
}

export function sectionLinks(month: number, year: number, directionId: number | null) {
  const qs = new URLSearchParams({ month: String(month), year: String(year) });
  if (directionId != null) qs.set("direction_id", String(directionId));
  return {
    setup: `/plans/setup?${qs.toString()}`,
    workdays: "/users/workdays",
    kpi_groups: "/settings/sales-directions/kpi-groups",
    sales_monitoring: "/dashboard/sales-monitoring"
  };
}

/** Tenant settings yo‘q bo‘lganda — Пн–Сб default. */
export function fallbackWorkdaysState(): WorkdaysState {
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
