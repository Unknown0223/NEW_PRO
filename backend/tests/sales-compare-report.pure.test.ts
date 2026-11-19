import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSalesCompareReportQuery, previousMonthYmd } from "../src/modules/reports/sales-compare-report.parse";

describe("sales-compare-report parseSalesCompareReportQuery", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults A=previous month and B=month-to-date", () => {
    vi.useFakeTimers({ now: new Date("2026-11-19T12:00:00") });
    const f = parseSalesCompareReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.group_by).toBe("product");
    expect(f.agent_ids).toEqual([]);
    expect(f.category_ids).toEqual([]);
    const prev = previousMonthYmd(new Date("2026-11-19T12:00:00"));
    expect(f.from_a).toBe(prev.from);
    expect(f.to_a).toBe(prev.to);
    expect(f.from_b).toBe("2026-11-01");
    expect(f.to_b).toBe("2026-11-19");
  });

  it("parses dual periods, group and filters", () => {
    const f = parseSalesCompareReportQuery({
      from_a: "2026-09-01",
      to_a: "2026-09-30",
      from_b: "2026-10-01",
      to_b: "2026-10-15",
      group_by: "client",
      agent_ids: "3,7",
      category_ids: "12",
      search: "  market  ",
      page: "2",
      limit: "100"
    });
    expect(f.from_a).toBe("2026-09-01");
    expect(f.to_a).toBe("2026-09-30");
    expect(f.from_b).toBe("2026-10-01");
    expect(f.to_b).toBe("2026-10-15");
    expect(f.group_by).toBe("client");
    expect(f.agent_ids).toEqual([3, 7]);
    expect(f.category_ids).toEqual([12]);
    expect(f.search).toBe("market");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(100);
  });

  it("drops unknown group_by", () => {
    const f = parseSalesCompareReportQuery({ group_by: "warehouse" });
    expect(f.group_by).toBe("product");
  });
});

describe("previousMonthYmd", () => {
  it("handles January boundary", () => {
    expect(previousMonthYmd(new Date("2026-01-10T00:00:00"))).toEqual({
      from: "2025-12-01",
      to: "2025-12-31"
    });
  });
});