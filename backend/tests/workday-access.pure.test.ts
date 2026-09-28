import { describe, expect, it } from "vitest";
import { computeWorkdayAccess, isWorkdayGuardExemptPath } from "../src/modules/tabel/workday-access";
import { defaultSchedules, type WorkdaysState } from "../src/modules/tabel/workdays.service";

function state(patch: Partial<WorkdaysState> = {}): WorkdaysState {
  return { schedules: defaultSchedules(), exceptions: [], overrides: [], enforce_access: true, ...patch };
}

/** 2026-09-27 — yakshanba, Toshkent 12:00. */
const SUNDAY_NOON = new Date("2026-09-27T07:00:00.000Z");
/** 2026-09-26 — shanba, Toshkent 10:00. */
const SATURDAY = new Date("2026-09-26T05:00:00.000Z");

describe("computeWorkdayAccess", () => {
  it("blocks mapped roles on an unchecked weekday and points to next work day start", () => {
    const s = computeWorkdayAccess(state(), "agent", 10, SUNDAY_NOON);
    expect(s.allowed).toBe(false);
    expect(s.role_label).toBe("Агент");
    expect(s.today).toBe("2026-09-27");
    expect(s.next_work_day).toBe("2026-09-28");
    expect(s.next_work_start).toBe("2026-09-27T19:00:00.000Z");
    expect(s.seconds_until_start).toBe(12 * 3600);
    expect(s.message).toContain("нерабочий день");
  });

  it("never restricts admin or unknown roles", () => {
    expect(computeWorkdayAccess(state(), "admin", 1, SUNDAY_NOON)).toMatchObject({ allowed: true, restricted: false });
    expect(computeWorkdayAccess(state(), "owner", 1, SUNDAY_NOON).allowed).toBe(true);
  });

  it("respects the enforce_access switch", () => {
    expect(computeWorkdayAccess(state({ enforce_access: false }), "agent", 10, SUNDAY_NOON).allowed).toBe(true);
  });

  it("uses per-role schedule (supervisor off on Saturday, agent works)", () => {
    expect(computeWorkdayAccess(state(), "supervisor", 5, SATURDAY).allowed).toBe(false);
    expect(computeWorkdayAccess(state(), "agent", 10, SATURDAY).allowed).toBe(true);
    const sup = computeWorkdayAccess(state(), "supervisor", 5, SATURDAY);
    expect(sup.next_work_day).toBe("2026-09-28");
  });

  it("forced/training exception opens a day off; holiday closes a work day", () => {
    const forced = state({
      exceptions: [{ id: "e1", role: "ALL", date: "2026-09-27", type: "forced", comment: "", createdBy: "t", createdAt: "" }]
    });
    expect(computeWorkdayAccess(forced, "agent", 10, SUNDAY_NOON).allowed).toBe(true);

    const holiday = state({
      exceptions: [{ id: "e2", role: "Агент", date: "2026-09-26", type: "holiday", comment: "Байрам", createdBy: "t", createdAt: "" }]
    });
    const s = computeWorkdayAccess(holiday, "agent", 10, SATURDAY);
    expect(s.allowed).toBe(false);
    expect(s.reason).toBe("exception");
    expect(s.comment).toBe("Байрам");
    expect(computeWorkdayAccess(holiday, "expeditor", 11, SATURDAY).allowed).toBe(true);
  });

  it("individual override beats role schedule", () => {
    const st = state({
      overrides: [
        {
          id: "o1",
          employeeId: "10",
          employeeName: "Ali",
          employeeCode: "",
          position: "Агент",
          schedule: [true, true, true, true, true, true, true],
          comment: ""
        }
      ]
    });
    expect(computeWorkdayAccess(st, "agent", 10, SUNDAY_NOON).allowed).toBe(true);
    expect(computeWorkdayAccess(st, "agent", 11, SUNDAY_NOON).allowed).toBe(false);
  });

  it("skips next days closed by holiday exceptions", () => {
    const st = state({
      exceptions: [{ id: "e3", role: "ALL", date: "2026-09-28", type: "holiday", comment: "", createdBy: "t", createdAt: "" }]
    });
    expect(computeWorkdayAccess(st, "agent", 10, SUNDAY_NOON).next_work_day).toBe("2026-09-29");
  });

  it("role with no working days is not restricted", () => {
    const schedules = defaultSchedules();
    schedules["Кассир"] = [false, false, false, false, false, false, false];
    expect(computeWorkdayAccess(state({ schedules }), "cashier", 3, SUNDAY_NOON).allowed).toBe(true);
  });
});

describe("isWorkdayGuardExemptPath", () => {
  it("keeps status and session endpoints open", () => {
    expect(isWorkdayGuardExemptPath("/api/aksit/me/workday-status")).toBe(true);
    expect(isWorkdayGuardExemptPath("/api/auth/me?x=1")).toBe(true);
    expect(isWorkdayGuardExemptPath("/api/auth/logout")).toBe(true);
    expect(isWorkdayGuardExemptPath("/api/aksit/orders")).toBe(false);
    expect(isWorkdayGuardExemptPath("/api/aksit/mobile/agent/sync")).toBe(false);
  });
});
