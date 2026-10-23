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

function parseCloseInt(raw: unknown, min: number, max: number): number | null {
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (Number.isInteger(n) && n >= min && n <= max) return n;
  return null;
}

/** `tenant.settings.consignment.month_close_day` — global / legacy fallback. */
export function parseConsignmentMonthCloseDay(settings: Prisma.JsonValue | null | undefined): number {
  return parseConsignmentCloseSchedule(settings).day;
}

/** Tenant global jadval: kun + soat + daqiqa (default 25 · 00:00). */
export function parseConsignmentCloseSchedule(
  settings: Prisma.JsonValue | null | undefined
): ConsignmentCloseSchedule {
  const root = asObj(settings);
  const cons = asObj(root.consignment);
  return {
    day: parseCloseInt(cons.month_close_day, 1, 31) ?? DEFAULT_CONSIGNMENT_CLOSE.day,
    hour: parseCloseInt(cons.month_close_hour, 0, 23) ?? DEFAULT_CONSIGNMENT_CLOSE.hour,
    minute: parseCloseInt(cons.month_close_minute, 0, 59) ?? DEFAULT_CONSIGNMENT_CLOSE.minute
  };
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

/**
 * Yopilish jadvali: avvalo tenant global, keyin agent maydonlari (legacy).
 * Bitta «hamma uchun» sozlama tenant settings da saqlanadi.
 */
export function resolveAgentConsignmentCloseSchedule(
  user: {
    consignment_close_day?: number | null;
    consignment_close_hour?: number | null;
    consignment_close_minute?: number | null;
  },
  tenantSettings?: Prisma.JsonValue | null
): ConsignmentCloseSchedule {
  const tenant = parseConsignmentCloseSchedule(tenantSettings);
  const root = asObj(tenantSettings);
  const cons = asObj(root.consignment);
  const hasTenantDay = parseCloseInt(cons.month_close_day, 1, 31) != null;
  if (hasTenantDay) return tenant;

  const day =
    user.consignment_close_day != null && user.consignment_close_day >= 1 && user.consignment_close_day <= 31
      ? user.consignment_close_day
      : tenant.day;
  const hour =
    user.consignment_close_hour != null && user.consignment_close_hour >= 0 && user.consignment_close_hour <= 23
      ? user.consignment_close_hour
      : tenant.hour;
  const minute =
    user.consignment_close_minute != null &&
    user.consignment_close_minute >= 0 &&
    user.consignment_close_minute <= 59
      ? user.consignment_close_minute
      : tenant.minute;
  return { day, hour, minute };
}

export function patchConsignmentSettings(
  settings: Prisma.JsonValue | null | undefined,
  schedule: ConsignmentCloseSchedule
): Prisma.InputJsonValue {
  const root = asObj(settings);
  const cons = asObj(root.consignment);
  return {
    ...root,
    consignment: {
      ...cons,
      month_close_day: schedule.day,
      month_close_hour: schedule.hour,
      month_close_minute: schedule.minute
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
