import type { WorkdaysState } from "../tabel/workdays.service";
import { isCalendarWorkingDay, ymdInTimeZone } from "../../lib/workday-calendar";
import type { AttendanceSource, AttendanceStatus } from "./timesheet.service";

/** GPS vizit orqali «ishladi» aniqlanadigan rollar; qolganlar grafik bo'yicha. */
const GPS_TRACKED_ROLES = new Set(["agent"]);

export function isGpsTrackedRole(role: string | null | undefined): boolean {
  return GPS_TRACKED_ROLES.has((role ?? "").trim().toLowerCase());
}

export type DefaultDayInput = {
  state: WorkdaysState;
  role: string | null | undefined;
  userId: number;
  ymd: string;
  hasGpsVisit: boolean;
  /** Tenant mahalliy `YYYY-MM-DD`; shu kundan oldin — ishlamagan. */
  hiredYmd: string | null;
  /** Tenant mahalliy `YYYY-MM-DD`; shu kundan keyin — ishlamagan. */
  dismissedYmd: string | null;
};

export type DefaultDayResult = {
  status: AttendanceStatus;
  source: AttendanceSource;
  off_employment: boolean;
};

export function isOutsideEmployment(ymd: string, hiredYmd: string | null, dismissedYmd: string | null): boolean {
  if (hiredYmd && ymd < hiredYmd) return true;
  if (dismissedYmd && ymd > dismissedYmd) return true;
  return false;
}

/**
 * Qo'lda belgilanmagan kun holati:
 * - ishga olishdan oldin / bo'shatilgandan keyin → «Выходной» (kelmadi emas);
 * - agent: GPS vizit → ishladi; aks holda ish kuni → kelmadi, dam olish → выходной;
 * - boshqa rollar: grafik bo'yicha ish kuni → ishladi (auto), aks holda выходной.
 */
export function defaultTimesheetDay(input: DefaultDayInput): DefaultDayResult {
  if (isOutsideEmployment(input.ymd, input.hiredYmd, input.dismissedYmd)) {
    return { status: "holiday", source: "auto", off_employment: true };
  }
  const role = (input.role ?? "").trim().toLowerCase();
  if (isGpsTrackedRole(role) && input.hasGpsVisit) {
    return { status: "worked", source: "gps", off_employment: false };
  }
  const working = isCalendarWorkingDay(input.state, role, input.userId, input.ymd);
  if (!working) return { status: "holiday", source: "auto", off_employment: false };
  if (isGpsTrackedRole(role)) return { status: "absent", source: "auto", off_employment: false };
  return { status: "worked", source: "auto", off_employment: false };
}

export function employmentYmd(value: Date | null | undefined, timeZone: string): string | null {
  return value ? ymdInTimeZone(value, timeZone) : null;
}

/** Vizitlar → `userId:YYYY-MM-DD` to'plami (tenant mahalliy kun). */
export function visitDayKeys(
  visits: Array<{ agent_id: number; checked_in_at: Date }>,
  timeZone: string
): Set<string> {
  const out = new Set<string>();
  for (const v of visits) out.add(`${v.agent_id}:${ymdInTimeZone(v.checked_in_at, timeZone)}`);
  return out;
}
