import { describe, expect, it } from "vitest";
import { parseExpeditorShareReportQuery } from "../src/modules/reports/expeditor-share-report.parse";

describe("expeditor-share parseExpeditorShareReportQuery", () => {
  it("defaults page and empty expeditor_ids", () => {
    const f = parseExpeditorShareReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.expeditor_ids).toEqual([]);
    expect(f.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses filters", () => {
    const f = parseExpeditorShareReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      expeditor_ids: "10,20",
      search: "  Ali  ",
      page: "2",
      limit: "25"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.expeditor_ids).toEqual([10, 20]);
    expect(f.search).toBe("Ali");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(25);
  });
});