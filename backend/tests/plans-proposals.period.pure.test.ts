import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  monthRangeUtc,
  previousPeriod,
  shiftPeriod,
  sourceMonthStatus
} from "../src/modules/plans/proposals/proposals.period";
import { somToTiyin, tiyinToSom, tiyinToSomString } from "../src/modules/plans/proposals/proposals.money";

describe("proposals.period", () => {
  it("previousPeriod wraps year", () => {
    expect(previousPeriod({ year: 2026, month: 1 })).toEqual({ year: 2025, month: 12 });
    expect(previousPeriod({ year: 2026, month: 11 })).toEqual({ year: 2026, month: 10 });
  });

  it("shiftPeriod moves months", () => {
    expect(shiftPeriod({ year: 2026, month: 11 }, 1)).toEqual({ year: 2026, month: 12 });
    expect(shiftPeriod({ year: 2026, month: 11 }, -2)).toEqual({ year: 2026, month: 9 });
  });

  it("monthRangeUtc uses Asia/Tashkent midnight", () => {
    const { from, to } = monthRangeUtc({ year: 2026, month: 10 });
    expect(from.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(to.toISOString()).toBe("2026-10-31T19:00:00.000Z");
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });

  it("sourceMonthStatus: final vs provisional MTD vs future", () => {
    const now = new Date("2026-11-16T10:00:00+05:00");
    expect(sourceMonthStatus({ year: 2026, month: 10 }, now)).toMatchObject({
      status: "final",
      observedDays: 31
    });
    expect(sourceMonthStatus({ year: 2026, month: 11 }, now)).toMatchObject({
      status: "provisional",
      observedDays: 16
    });
    expect(sourceMonthStatus({ year: 2026, month: 12 }, now)).toMatchObject({
      status: "provisional",
      observedDays: 0
    });
  });
});

describe("proposals.money", () => {
  it("converts som ↔ tiyin", () => {
    expect(somToTiyin(12.34)).toBe("1234");
    expect(somToTiyin(null)).toBeNull();
    expect(tiyinToSom("1234")).toBe(12.34);
    expect(tiyinToSomString("100")).toBe("1.00");
  });
});
