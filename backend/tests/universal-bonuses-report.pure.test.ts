import { describe, expect, it } from "vitest";
import { parseUniversalBonusesReportQuery } from "../src/modules/reports/universal-bonuses-report.service";

describe("universal-bonuses parseUniversalBonusesReportQuery", () => {
  it("defaults empty filters, product group, created_at date", () => {
    const f = parseUniversalBonusesReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.group_by).toBe("product");
    expect(f.date_type).toBe("created_at");
    expect(f.statuses).toEqual([]);
    expect(f.agent_ids).toEqual([]);
    expect(f.category_ids).toEqual([]);
  });

  it("parses date range, group, and multi filters", () => {
    const f = parseUniversalBonusesReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      date_type: "shipped_date",
      group_by: "agent",
      statuses: "delivered,delivering",
      agent_ids: "2,9",
      category_ids: "1",
      client_categories: "A,B",
      territory_1_list: "Andijon",
      search: "  milk  ",
      page: "2",
      limit: "100"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.date_type).toBe("shipped_date");
    expect(f.group_by).toBe("agent");
    expect(f.statuses).toEqual(["delivered", "delivering"]);
    expect(f.agent_ids).toEqual([2, 9]);
    expect(f.category_ids).toEqual([1]);
    expect(f.client_categories).toEqual(["A", "B"]);
    expect(f.territory_1_list).toEqual(["Andijon"]);
    expect(f.search).toBe("milk");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(100);
  });

  it("drops unknown date_type and group_by", () => {
    const f = parseUniversalBonusesReportQuery({
      date_type: "bogus",
      group_by: "warehouse"
    });
    expect(f.date_type).toBe("created_at");
    expect(f.group_by).toBe("product");
  });
});