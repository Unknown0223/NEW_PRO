import type { Prisma } from "@prisma/client";

export const DEFAULT_CONSIGNMENT_MONTH_CLOSE_DAY = 25;

export type ConsignmentCloseSchedule = {
  day: number;
  hour: number;
  minute: number;
};

export const DEFAULT_CONSIGNMENT_CLOSE: ConsignmentCloseSchedule = {
  day: DEFAULT_CONSIGNMENT_MONTH_CLOSE_DAY,
  hour: 0,
  minute: 0
};

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(Math.max(min, n), max);
}

/** `tenant.settings.consignment.month_close_day` — legacy fallback. */
export function parseConsignmentMonthCloseDay(settings: Prisma.JsonValue | null | undefined): number {
  const root = asObj(settings);
  const cons = asObj(root.consignment);
  const raw = cons.month_close_day;
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
  return DEFAULT_CONSIGNMENT_MONTH_CLOSE_DAY;
}

export function validateConsignmentCloseSchedule(input: {
  day: number;
  hour: number;
  minute: number;
}): ConsignmentCloseSchedule {
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) {
    throw new Error("BAD_CLOSE_DAY");
  }
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("BAD_CLOSE_HOUR");
  }
  if (!Number.isInteger(input.minute) || input.minute < 0 || input.minute > 59) {
    throw new Error("BAD_CLOSE_MINUTE");
  }
  return { day: input.day, hour: input.hour, minute: input.minute };
}

export function resolveAgentConsignmentCloseSchedule(
  user: {
    consignment_close_day?: number | null;
    consignment_close_hour?: number | null;
    consignment_close_minute?: number | null;
  },
  tenantSettings?: Prisma.JsonValue | null
): ConsignmentCloseSchedule {
  const day =
    user.consignment_close_day != null && user.consignment_close_day >= 1 && user.consignment_close_day <= 31
      ? user.consignment_close_day
      : parseConsignmentMonthCloseDay(tenantSettings);
  const hour =
    user.consignment_close_hour != null && user.consignment_close_hour >= 0 && user.consignment_close_hour <= 23
      ? user.consignment_close_hour
      : 0;
  const minute =
    user.consignment_close_minute != null &&
    user.consignment_close_minute >= 0 &&
    user.consignment_close_minute <= 59
      ? user.consignment_close_minute
      : 0;
  return { day, hour, minute };
}

export function patchConsignmentSettings(
  settings: Prisma.JsonValue | null | undefined,
  monthCloseDay: number
): Prisma.InputJsonValue {
  const root = asObj(settings);
  const cons = asObj(root.consignment);
  return {
    ...root,
    consignment: {
      ...cons,
      month_close_day: monthCloseDay
    }
  };
}

/** Oyning oxirgi kuni (1-based month). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Konsignatsiya yopilish vaqti (UTC). */
export function utcConsignmentPeriodCloseAt(
  year: number,
  month: number,
  schedule: ConsignmentCloseSchedule
): Date {
  const day = clampInt(schedule.day, 1, daysInMonth(year, month));
  const hour = clampInt(schedule.hour, 0, 23);
  const minute = clampInt(schedule.minute, 0, 59);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));
}

export function utcMonthEndExclusive(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
}

/** Kun boshidan (UTC) — `debt_cleared_at` uchun. */
export function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}
