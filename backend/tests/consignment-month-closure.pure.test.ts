import { describe, expect, it } from "vitest";
import {
  consignmentYearMonthInTimeZone,
  daysInMonth,
  parseConsignmentCloseSchedule,
  parseConsignmentMonthCloseDay,
  previousConsignmentYearMonth,
  utcConsignmentPeriodCloseAt
} from "../src/modules/consignment/consignment-settings";
import { computeSupervisorGroupDebtClearedAt } from "../src/modules/consignment/consignment-month-closure.service";

describe("consignment month closure settings", () => {
  it("defaults close day to 25", () => {
    expect(parseConsignmentMonthCloseDay({})).toBe(25);
    expect(parseConsignmentMonthCloseDay({ consignment: { month_close_day: 28 } })).toBe(28);
  });

  it("parses full tenant close schedule", () => {
    expect(parseConsignmentCloseSchedule({})).toEqual({ day: 25, hour: 0, minute: 0 });
    expect(
      parseConsignmentCloseSchedule({
        consignment: { month_close_day: 20, month_close_hour: 18, month_close_minute: 30 }
      })
    ).toEqual({ day: 20, hour: 18, minute: 30 });
  });

  it("clamps close day to month length", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    const feb = utcConsignmentPeriodCloseAt(2026, 2, { day: 31, hour: 0, minute: 0 }, "UTC");
    expect(feb.getUTCDate()).toBe(28);
    expect(feb.getUTCMonth()).toBe(1);
  });

  it("closes at the tenant minute and stays open one minute earlier", () => {
    const at = utcConsignmentPeriodCloseAt(
      2026,
      10,
      { day: 25, hour: 17, minute: 30 },
      "Asia/Tashkent"
    );
    expect(at.toISOString()).toBe("2026-10-25T12:30:00.000Z");
    const before = new Date(at.getTime() - 60_000);
    expect(before >= at).toBe(false);
    expect(at >= at).toBe(true);
    expect(new Date("2026-10-30T17:00:00.000Z") >= at).toBe(true);
  });

  it("closes on tenant local wall time, not UTC midnight", () => {
    const at = utcConsignmentPeriodCloseAt(
      2026,
      10,
      { day: 30, hour: 0, minute: 0 },
      "Asia/Tashkent"
    );
    expect(at.toISOString()).toBe("2026-10-29T19:00:00.000Z");
  });

  it("reads year-month in tenant timezone", () => {
    const now = new Date("2026-09-30T20:30:00.000Z");
    expect(consignmentYearMonthInTimeZone(now, "Asia/Tashkent")).toEqual({ year: 2026, month: 10 });
    expect(previousConsignmentYearMonth(2026, 10)).toEqual({ year: 2026, month: 9 });
    expect(previousConsignmentYearMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it("supervisor group cleared when all agents cleared", () => {
    const d1 = new Date("2026-06-28T00:00:00.000Z");
    const d2 = new Date("2026-06-30T00:00:00.000Z");
    expect(
      computeSupervisorGroupDebtClearedAt([
        { debt_cleared_at: d1 },
        { debt_cleared_at: d2 }
      ])?.toISOString()
    ).toBe(d2.toISOString());
    expect(
      computeSupervisorGroupDebtClearedAt([
        { debt_cleared_at: d1 },
        { debt_cleared_at: null }
      ])
    ).toBeNull();
  });
});
