import { describe, expect, it } from "vitest";
import { parseUniversalReturnsReportQuery } from "../src/modules/reports/universal-returns-report.service";

describe("universal-returns parseUniversalReturnsReportQuery", () => {
  it("defaults shipped_date and pagination", () => {
    const f = parseUniversalReturnsReportQuery({});
    expect(f.date_type).toBe("shipped_date");
    expect(f.page).toBe(1);
    expect(f.expeditor_ids).toEqual([]);
  });

  it("parses filters", () => {
    const f = parseUniversalReturnsReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      date_type: "order_date",
      expeditor_ids: "3,4",
      agent_ids: "1",
      search: "  milk  "
    });
    expect(f.date_type).toBe("order_date");
    expect(f.expeditor_ids).toEqual([3, 4]);
    expect(f.agent_ids).toEqual([1]);
    expect(f.search).toBe("milk");
  });
});
