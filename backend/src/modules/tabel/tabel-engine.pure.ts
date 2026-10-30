/**
 * SALEC Tabel va Davomat dvijogi (HR Hub integratsiyasi — pure mantiq).
 * - 15 ta kunlik holat (DayStatus) va ustuvorlik zanjiri
 * - Kun ichidagi belgilar: 1-kirish (`in`), o'rta (`estimated_out`), oxirgi (`out` — smena tugagach yoki 23:59 da)
 * - Kechikish imtiyozi (`applyLateAllowance`: oyiga N marta, M daqiqagacha kechiriladi)
 */

export const ALL_ATTENDANCE_STATUSES = [
  "worked",
  "late",
  "early_leave",
  "half_day",
  "absent",
  "excused_absent",
  "vacation",
  "unpaid_leave",
  "sick",
  "trip",
  "holiday",
  "overtime",
  "weekend_work",
  "remote",
  "not_started"
] as const;

export type ExtendedAttendanceStatus = (typeof ALL_ATTENDANCE_STATUSES)[number];

export const ALL_ATTENDANCE_SOURCES = [
  "manual",
  "gps",
  "mobile_login",
  "auto",
  "mobile_photo",
  "mobile_video",
  "kiosk",
  "terminal",
  "request"
] as const;

export type ExtendedAttendanceSource = (typeof ALL_ATTENDANCE_SOURCES)[number];

export const EXTENDED_STATUS_LABEL_RU: Record<ExtendedAttendanceStatus, string> = {
  worked: "Работал",
  late: "Опоздал",
  early_leave: "Ранний уход",
  half_day: "Полдня",
  absent: "Отсутствовал",
  excused_absent: "Уважительная причина",
  vacation: "Отпуск",
  unpaid_leave: "Без содержания (БС)",
  sick: "Больничный",
  trip: "Командировка",
  holiday: "Выходной",
  overtime: "Сверхурочно",
  weekend_work: "Работа в выходной",
  remote: "Удалённо",
  not_started: "Не начался"
};

export function extendedStatusWorkValue(
  status: ExtendedAttendanceStatus,
  opts?: { lateExcused?: boolean; penalizeUnexcusedLateAsHalfDay?: boolean }
): number {
  switch (status) {
    case "worked":
    case "trip":
    case "overtime":
    case "weekend_work":
    case "remote":
      return 1;
    case "late":
      if (opts?.lateExcused !== false) return 1;
      return opts?.penalizeUnexcusedLateAsHalfDay ? 0.5 : 1;
    case "early_leave":
    case "half_day":
      return 0.5;
    default:
      return 0;
  }
}

export type DayMarkRole = "in" | "estimated_out" | "out";

export function parseHmMinutes(hm: string, fallback = 9 * 60): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm ?? "").trim());
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return fallback;
  return hh * 60 + mm;
}

export function minutesInTimeZone(date: Date, timeZone = "Asia/Tashkent"): number {
  if (!date || Number.isNaN(date.getTime())) return 0;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (hh || 0) * 60 + (mm || 0);
}

/** Smena tugaganmi yoki kun 23:59 ga yetganmi. */
export function isShiftOrDayClosed(
  workYmd: string,
  now: Date,
  scheduleEndHm = "18:00",
  timeZone = "Asia/Tashkent"
): boolean {
  const nowYmd = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  if (nowYmd > workYmd) return true;
  if (nowYmd < workYmd) return false;
  const nowMin = minutesInTimeZone(now, timeZone);
  if (nowMin >= 23 * 60 + 59) return true;
  const endMin = parseHmMinutes(scheduleEndHm, 18 * 60);
  return nowMin >= endMin;
}

/** 1-belgi: `in`, smena tugaganda oxirgi belgi: `out`, oraliq belgilar: `estimated_out`. */
export function roleForDayMark(index: number, total: number, lastOutOfficial: boolean): DayMarkRole {
  if (total <= 0 || index <= 0) return "in";
  if (index === total - 1 && total >= 2 && lastOutOfficial) return "out";
  return "estimated_out";
}

export type LatenessRules = {
  excusedEnabled: boolean;
  excusedPerMonth: number;
  excusedMaxMinutes: number;
  earlyLeaveGraceMinutes: number;
  penalizeUnexcusedLateAsHalfDay: boolean;
  notifyTerminalArrival: boolean;
  strictNonAgentAbsent: boolean;
};

export const DEFAULT_LATENESS_RULES: LatenessRules = {
  excusedEnabled: true,
  excusedPerMonth: 3,
  excusedMaxMinutes: 15,
  earlyLeaveGraceMinutes: 15,
  penalizeUnexcusedLateAsHalfDay: false,
  notifyTerminalArrival: true,
  strictNonAgentAbsent: false
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function normalizeLatenessRules(raw: unknown): LatenessRules {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_LATENESS_RULES;
  return {
    excusedEnabled: typeof p.excusedEnabled === "boolean" ? p.excusedEnabled : d.excusedEnabled,
    excusedPerMonth: clampInt(p.excusedPerMonth, 0, 31, d.excusedPerMonth),
    excusedMaxMinutes: clampInt(p.excusedMaxMinutes, 1, 24 * 60, d.excusedMaxMinutes),
    earlyLeaveGraceMinutes: clampInt(p.earlyLeaveGraceMinutes, 0, 240, d.earlyLeaveGraceMinutes),
    penalizeUnexcusedLateAsHalfDay:
      typeof p.penalizeUnexcusedLateAsHalfDay === "boolean"
        ? p.penalizeUnexcusedLateAsHalfDay
        : d.penalizeUnexcusedLateAsHalfDay,
    notifyTerminalArrival:
      typeof p.notifyTerminalArrival === "boolean" ? p.notifyTerminalArrival : d.notifyTerminalArrival,
    strictNonAgentAbsent:
      typeof p.strictNonAgentAbsent === "boolean" ? p.strictNonAgentAbsent : d.strictNonAgentAbsent
  };
}

export type LateDayInput = { date: string; status: string; lateMinutes: number | null };
export type LateVerdict = { lateExcused: boolean; fullDay: boolean };

/** Oy ichida sana tartibida dastlabki `excusedPerMonth` ta (<= `excusedMaxMinutes`) kechikish kechiriladi. */
export function applyLateAllowance<T extends LateDayInput>(
  days: T[],
  rules: Pick<LatenessRules, "excusedEnabled" | "excusedPerMonth" | "excusedMaxMinutes">
): Array<T & LateVerdict> {
  const verdicts = new Map<T, LateVerdict>();
  const used = new Map<string, number>();
  const ordered = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of ordered) {
    if (day.status !== "late" || !rules.excusedEnabled) {
      verdicts.set(day, { lateExcused: false, fullDay: true });
      continue;
    }
    const month = day.date.slice(0, 7);
    const spent = used.get(month) ?? 0;
    const minutes = day.lateMinutes ?? 0;
    const excused = minutes <= rules.excusedMaxMinutes && spent < rules.excusedPerMonth;
    if (excused) used.set(month, spent + 1);
    verdicts.set(day, { lateExcused: excused, fullDay: excused });
  }
  return days.map((d) => ({ ...d, ...verdicts.get(d)! }));
}

export function excusedLeft(
  days: Array<LateDayInput & LateVerdict>,
  rules: Pick<LatenessRules, "excusedEnabled" | "excusedPerMonth">
): number | null {
  if (!rules.excusedEnabled) return null;
  const used = days.filter((d) => d.lateExcused).length;
  return Math.max(0, rules.excusedPerMonth - used);
}

export type ShiftSpec = {
  start_time: string;
  end_time: string;
  break_minutes: number;
  grace_minutes: number;
};

export const DEFAULT_SHIFT_SPEC: ShiftSpec = {
  start_time: "09:00",
  end_time: "18:00",
  break_minutes: 60,
  grace_minutes: 15
};

export type PunchEvalItem = { id?: number; occurred_at: Date; source: string; is_valid: boolean };

export type ComputedDayFromPunches = {
  status: ExtendedAttendanceStatus;
  source: ExtendedAttendanceSource;
  first_in_at: Date | null;
  last_out_at: Date | null;
  late_minutes: number;
  early_leave_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
  punch_roles: Array<{ index: number; id?: number; role_in_day: DayMarkRole }>;
};

export function computeDayFromPunches(input: {
  workYmd: string;
  now: Date;
  timeZone?: string;
  isWorkingDay: boolean;
  shift?: ShiftSpec;
  earlyLeaveGraceMinutes?: number;
  punches: PunchEvalItem[];
  approvedRequest?: { type: string; hours?: number | null } | null;
}): ComputedDayFromPunches {
  const tz = input.timeZone ?? "Asia/Tashkent";
  const shift = input.shift ?? DEFAULT_SHIFT_SPEC;
  const valid = [...input.punches]
    .filter((p) => p.is_valid)
    .sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime());

  const closed = isShiftOrDayClosed(input.workYmd, input.now, shift.end_time, tz);
  const lastOutOfficial = valid.length >= 2 && closed;
  const punch_roles = valid.map((p, idx) => ({
    index: idx,
    id: p.id,
    role_in_day: roleForDayMark(idx, valid.length, lastOutOfficial)
  }));

  if (input.approvedRequest) {
    const reqType = input.approvedRequest.type.trim().toLowerCase();
    const overtimeMin =
      reqType === "overtime" || reqType === "weekend_work"
        ? Math.round(Math.max(0, Number(input.approvedRequest.hours ?? 0)) * 60)
        : 0;
    const statusMap: Record<string, ExtendedAttendanceStatus> = {
      vacation: "vacation",
      sick: "sick",
      trip: "trip",
      unpaid_leave: "unpaid_leave",
      excused_absent: "excused_absent",
      overtime: "overtime",
      weekend_work: "weekend_work",
      remote: "remote",
      early_leave: "early_leave"
    };
    const st = statusMap[reqType] ?? "vacation";
    return {
      status: st,
      source: "request",
      first_in_at: valid[0]?.occurred_at ?? null,
      last_out_at: lastOutOfficial ? valid[valid.length - 1]!.occurred_at : null,
      late_minutes: 0,
      early_leave_minutes: 0,
      worked_minutes: st === "trip" || st === "remote" || st === "overtime" || st === "weekend_work" ? 480 : 0,
      overtime_minutes: overtimeMin,
      punch_roles
    };
  }

  if (valid.length === 0) {
    const nowYmd = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(input.now);
    const status: ExtendedAttendanceStatus = !input.isWorkingDay
      ? "holiday"
      : input.workYmd > nowYmd
        ? "not_started"
        : "absent";
    return {
      status,
      source: "auto",
      first_in_at: null,
      last_out_at: null,
      late_minutes: 0,
      early_leave_minutes: 0,
      worked_minutes: 0,
      overtime_minutes: 0,
      punch_roles: []
    };
  }

  const firstIn = valid[0]!.occurred_at;
  const lastOut = lastOutOfficial ? valid[valid.length - 1]!.occurred_at : null;
  const inMin = minutesInTimeZone(firstIn, tz);
  const startMin = parseHmMinutes(shift.start_time, 9 * 60);
  const endMin = parseHmMinutes(shift.end_time, 18 * 60);
  const grace = Math.max(0, shift.grace_minutes ?? 15);
  const earlyGrace = Math.max(0, input.earlyLeaveGraceMinutes ?? 15);

  const late_minutes = input.isWorkingDay ? Math.max(0, inMin - (startMin + grace)) : 0;
  let early_leave_minutes = 0;
  let worked_minutes = 0;
  let overtime_minutes = 0;

  if (lastOut) {
    const outMin = minutesInTimeZone(lastOut, tz);
    if (input.isWorkingDay && outMin < endMin - earlyGrace) {
      early_leave_minutes = Math.max(0, endMin - outMin);
    }
    const rawSpan = Math.max(0, outMin - inMin);
    const breakDeduct = rawSpan > (shift.break_minutes ?? 60) + 120 ? (shift.break_minutes ?? 60) : 0;
    worked_minutes = Math.max(0, rawSpan - breakDeduct);
    if (input.isWorkingDay && outMin > endMin + 30) {
      overtime_minutes = outMin - endMin;
    } else if (!input.isWorkingDay) {
      overtime_minutes = worked_minutes;
    }
  } else {
    worked_minutes = Math.max(60, endMin - Math.max(inMin, startMin) - (shift.break_minutes ?? 60));
  }

  const rawSource = valid[0]!.source;
  const source: ExtendedAttendanceSource = (ALL_ATTENDANCE_SOURCES as readonly string[]).includes(rawSource)
    ? (rawSource as ExtendedAttendanceSource)
    : "mobile_photo";

  let status: ExtendedAttendanceStatus = "worked";
  if (!input.isWorkingDay) status = "weekend_work";
  else if (late_minutes > 0) status = "late";
  else if (early_leave_minutes > 0) status = "early_leave";

  return {
    status,
    source,
    first_in_at: firstIn,
    last_out_at: lastOut,
    late_minutes,
    early_leave_minutes,
    worked_minutes,
    overtime_minutes,
    punch_roles
  };
}
