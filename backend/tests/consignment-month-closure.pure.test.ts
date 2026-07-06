import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  parseConsignmentMonthCloseDay,
  utcConsignmentPeriodCloseAt
} from "../src/modules/consignment/consignment-settings";
import { computeSupervisorGroupDebtClearedAt } from "../src/modules/consignment/consignment-month-closure.service";

describe("consignment month closure settings", () => {
  it("defaults close day to 25", () => {
    expect(parseConsignmentMonthCloseDay({})).toBe(25);
    expect(parseConsignmentMonthCloseDay({ consignment: { month_close_day: 28 } })).toBe(28);
  });

  it("clamps close day to month length", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    const feb = utcConsignmentPeriodCloseAt(2026, 2, { day: 31, hour: 0, minute: 0 });
    expect(feb.getUTCDate()).toBe(28);
    expect(feb.getUTCMonth()).toBe(1);
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
