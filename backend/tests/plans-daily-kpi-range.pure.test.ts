import { describe, expect, it } from "vitest";
import { dailyKpiDayMatrixQuerySchema } from "../src/modules/plans/plans.daily-kpi.schema";
import { monthBounds } from "../src/modules/plans/plans.daily-kpi.helpers";

describe("daily KPI period (single month only)", () => {
  it("accepts a range inside one month", () => {
    const r = dailyKpiDayMatrixQuerySchema.safeParse({ day: "2026-09-01", day_to: "2026-09-30" });
    expect(r.success).toBe(true);
  });

  it("rejects a range crossing a month boundary", () => {
    const r = dailyKpiDayMatrixQuerySchema.safeParse({ day: "2026-08-31", day_to: "2026-09-01" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("RANGE_CROSS_MONTH");
  });

  it("rejects reversed range", () => {
    const r = dailyKpiDayMatrixQuerySchema.safeParse({ day: "2026-09-10", day_to: "2026-09-05" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("RANGE_ORDER");
  });

  it("single day stays valid without day_to", () => {
    const r = dailyKpiDayMatrixQuerySchema.safeParse({ day: "2026-09-27" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.day_to).toBeUndefined();
  });

  it("month bounds follow Asia/Tashkent midnight (no day from neighbour months)", () => {
    const { start, end, daysInMonth } = monthBounds(2026, 9);
    expect(start.toISOString()).toBe("2026-08-31T19:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T19:00:00.000Z");
    expect(daysInMonth).toBe(30);
    // 31 avgust 23:30 Toshkent — avgustga tegishli, sentyabrga kirmaydi
    const lateAugust = new Date("2026-08-31T18:30:00.000Z");
    expect(lateAugust >= start).toBe(false);
    // 1 oktyabr 00:30 Toshkent — sentyabrga kirmaydi
    const earlyOctober = new Date("2026-09-30T19:30:00.000Z");
    expect(earlyOctober < end).toBe(false);
  });
});
