import { describe, expect, it } from "vitest";
import {
  isManualDayLock,
  parseTimesheetOverrideKey,
  resolveAttendanceCell
} from "../src/modules/timesheet/timesheet.day-ledger";

describe("timesheet day ledger", () => {
  it("treats override_by or source=manual as a lock", () => {
    expect(isManualDayLock(null)).toBe(false);
    expect(isManualDayLock({ source: "mobile_photo", override_by: null })).toBe(false);
    expect(isManualDayLock({ source: "manual", override_by: null })).toBe(true);
    expect(isManualDayLock({ source: "auto", override_by: 7 })).toBe(true);
  });

  it("prefers the day record over the calendar default", () => {
    expect(
      resolveAttendanceCell({ status: "sick", source: "manual" }, { status: "worked", source: "auto" })
    ).toEqual({ status: "sick", source: "manual" });
    expect(resolveAttendanceCell(undefined, { status: "worked", source: "auto" })).toEqual({
      status: "worked",
      source: "auto"
    });
  });

  it("parses userId:ymd override keys", () => {
    expect(parseTimesheetOverrideKey("12:2026-10-25")).toEqual({ userId: 12, ymd: "2026-10-25" });
    expect(parseTimesheetOverrideKey("bad")).toBeNull();
    expect(parseTimesheetOverrideKey("0:2026-10-25")).toBeNull();
  });
});
