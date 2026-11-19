import { describe, expect, it } from "vitest";
import { parseUniversalVisitsReportQuery } from "../src/modules/reports/universal-visits-report.service";

describe("universal-visits parseUniversalVisitsReportQuery", () => {
  it("defaults page/limit and empty filters", () => {
    const f = parseUniversalVisitsReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.agent_ids).toEqual([]);
    expect(f.supervisor_ids).toEqual([]);
    expect(f.statuses).toEqual([]);
    expect(f.visit_kinds).toEqual([]);
    expect(f.client_categories).toEqual([]);
    expect(f.territory_1_list).toEqual([]);
    expect(f.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses filters and visit_kinds", () => {
    const f = parseUniversalVisitsReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      agent_ids: "3,4",
      supervisor_ids: "9",
      statuses: "delivered,confirmed",
      visit_kinds: "planned,unplanned",
      client_categories: "A,B",
      territory_1_list: "Andijon",
      territory_2_list: "Zone",
      territory_3_list: "City",
      search: "  Ali  ",
      page: "2",
      limit: "80"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.agent_ids).toEqual([3, 4]);
    expect(f.supervisor_ids).toEqual([9]);
    expect(f.statuses).toEqual(["delivered", "confirmed"]);
    expect(f.visit_kinds).toEqual(["planned", "unplanned"]);
    expect(f.client_categories).toEqual(["A", "B"]);
    expect(f.territory_1_list).toEqual(["Andijon"]);
    expect(f.territory_2_list).toEqual(["Zone"]);
    expect(f.territory_3_list).toEqual(["City"]);
    expect(f.search).toBe("Ali");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(80);
  });

  it("drops unknown visit_kinds", () => {
    const f = parseUniversalVisitsReportQuery({ visit_kinds: "planned,foo,unplanned" });
    expect(f.visit_kinds).toEqual(["planned", "unplanned"]);
  });
});