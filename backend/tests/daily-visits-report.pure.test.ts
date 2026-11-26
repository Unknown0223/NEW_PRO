import { describe, expect, it } from "vitest";
import { parseDailyVisitsReportQuery } from "../src/modules/reports/daily-visits-report.parse";
import {
  DAILY_VISITS_MONTH_OPTIONS,
  MONTH_NAMES_RU
} from "../src/modules/reports/daily-visits-report.month-options";

describe("daily-visits month filter labels", () => {
  it("exposes 12 months with Russian names (ids stay 1–12)", () => {
    expect(DAILY_VISITS_MONTH_OPTIONS).toHaveLength(12);
    expect(DAILY_VISITS_MONTH_OPTIONS[0]).toEqual({ id: "1", label: "Январь" });
    expect(DAILY_VISITS_MONTH_OPTIONS[10]).toEqual({ id: "11", label: "Ноябрь" });
    expect(DAILY_VISITS_MONTH_OPTIONS.map((m) => m.label)).toEqual([...MONTH_NAMES_RU]);
    expect(DAILY_VISITS_MONTH_OPTIONS.every((m) => m.label !== m.id)).toBe(true);
  });
});

describe("daily-visits-report parseDailyVisitsReportQuery", () => {
  it("defaults to current month bounds and empty filters", () => {
    const f = parseDailyVisitsReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.agent_ids).toEqual([]);
    expect(f.visit_kinds).toEqual([]);
    expect(f.year).toBeGreaterThanOrEqual(2020);
    expect(f.month).toBeGreaterThanOrEqual(1);
    expect(f.month).toBeLessThanOrEqual(12);
    expect(f.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(f.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses year month agents and visit_kinds", () => {
    const f = parseDailyVisitsReportQuery({
      year: "2026",
      month: "11",
      agent_ids: "3,4",
      visit_kinds: "planned,unplanned",
      search: "  Ali  ",
      page: "2",
      limit: "80"
    });
    expect(f.year).toBe(2026);
    expect(f.month).toBe(11);
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-30");
    expect(f.agent_ids).toEqual([3, 4]);
    expect(f.visit_kinds).toEqual(["planned", "unplanned"]);
    expect(f.search).toBe("Ali");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(80);
  });

  it("clamps month and drops unknown visit_kinds", () => {
    const f = parseDailyVisitsReportQuery({ year: "2026", month: "99", visit_kinds: "planned,x" });
    expect(f.month).toBe(12);
    expect(f.visit_kinds).toEqual(["planned"]);
  });
});
