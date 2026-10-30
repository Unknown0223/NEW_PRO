import { describe, expect, it } from "vitest";
import {
  decideCalendarDay,
  listCalendarWorkingDays,
  tenantMonthRangeUtc,
  ymdInTimeZone
} from "../src/lib/workday-calendar";
import { defaultTimesheetDay } from "../src/modules/timesheet/timesheet.day-status";
import type { WorkdaysState } from "../src/modules/tabel/workdays.service";

function state(partial: Partial<WorkdaysState> = {}): WorkdaysState {
  return {
    schedules: {} as WorkdaysState["schedules"],
    exceptions: [],
    overrides: [],
    ...partial
  } as WorkdaysState;
}

describe("workday-calendar", () => {
  it("role exception wins over ALL exception and schedules", () => {
    const s = state({
      exceptions: [
        { id: "1", date: "2026-09-06", role: "ALL", type: "holiday", comment: "" },
        { id: "2", date: "2026-09-06", role: "Агент", type: "forced", comment: "" }
      ] as WorkdaysState["exceptions"]
    });
    expect(decideCalendarDay(s, "agent", 1, "2026-09-06")).toMatchObject({ working: true, reason: "exception" });
    expect(decideCalendarDay(s, "expeditor", 2, "2026-09-06")).toMatchObject({ working: false, reason: "exception" });
  });

  it("role without schedule uses default Mon–Sat", () => {
    const s = state();
    expect(decideCalendarDay(s, "accountant", 1, "2026-09-06").working).toBe(false); // Sunday
    expect(decideCalendarDay(s, "accountant", 1, "2026-09-07").working).toBe(true); // Monday
    expect(listCalendarWorkingDays(s, "accountant", 1, 2026, 9)).toHaveLength(26);
  });

  it("individual override applies before role schedule", () => {
    const s = state({
      schedules: { Агент: [true, true, true, true, true, false, false] } as WorkdaysState["schedules"],
      overrides: [{ employeeId: "7", schedule: [false, false, false, false, false, true, true] }] as WorkdaysState["overrides"]
    });
    expect(decideCalendarDay(s, "agent", 7, "2026-09-06").working).toBe(true);
    expect(decideCalendarDay(s, "agent", 8, "2026-09-06").working).toBe(false);
  });

  it("tenant timezone: 00:00–05:00 Tashkent belongs to the local day", () => {
    const instant = new Date("2026-09-30T20:30:00.000Z"); // 01:30 on Oct 1 in Tashkent
    expect(ymdInTimeZone(instant, "Asia/Tashkent")).toBe("2026-10-01");
    const r = tenantMonthRangeUtc(2026, 10, "Asia/Tashkent");
    expect(r.from.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-31T19:00:00.000Z");
  });
});

describe("defaultTimesheetDay", () => {
  const s = state();
  const base = { state: s, userId: 1, hasGpsVisit: false, hiredYmd: null, dismissedYmd: null };

  it("non-GPS role is worked on schedule days, holiday otherwise", () => {
    expect(defaultTimesheetDay({ ...base, role: "expeditor", ymd: "2026-09-07" })).toMatchObject({
      status: "worked",
      source: "auto"
    });
    expect(defaultTimesheetDay({ ...base, role: "expeditor", ymd: "2026-09-06" }).status).toBe("holiday");
  });

  it("agent: GPS visit worked, else absent on working day", () => {
    expect(defaultTimesheetDay({ ...base, role: "agent", ymd: "2026-09-07", hasGpsVisit: true })).toMatchObject({
      status: "worked",
      source: "gps"
    });
    expect(defaultTimesheetDay({ ...base, role: "agent", ymd: "2026-09-07" }).status).toBe("absent");
  });

  it("days before hire and after dismissal are not-worked, not absent", () => {
    const r1 = defaultTimesheetDay({ ...base, role: "agent", ymd: "2026-09-07", hiredYmd: "2026-09-10" });
    expect(r1).toMatchObject({ status: "holiday", off_employment: true });
    const r2 = defaultTimesheetDay({ ...base, role: "expeditor", ymd: "2026-09-21", dismissedYmd: "2026-09-20" });
    expect(r2).toMatchObject({ status: "holiday", off_employment: true });
    const r3 = defaultTimesheetDay({ ...base, role: "expeditor", ymd: "2026-09-19", dismissedYmd: "2026-09-20" });
    expect(r3.status).toBe("worked");
  });
});
