import { describe, expect, it } from "vitest";
import { parseExpeditorVisitsReportQuery } from "../src/modules/reports/expeditor-visits-report.parse";

describe("expeditor-visits parseExpeditorVisitsReportQuery", () => {
  it("defaults page and empty expeditor_ids", () => {
    const f = parseExpeditorVisitsReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.expeditor_ids).toEqual([]);
    expect(f.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses filters", () => {
    const f = parseExpeditorVisitsReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      expeditor_ids: "10,20",
      search: "  Xayot  ",
      page: "2",
      limit: "25"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.expeditor_ids).toEqual([10, 20]);
    expect(f.search).toBe("Xayot");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(25);
  });
});
