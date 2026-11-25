import { describe, expect, it } from "vitest";
import { parseBonusesReportQuery } from "../src/modules/reports/bonuses-report.parse";
import { bonusesDateExpr } from "../src/modules/reports/bonuses.dates";

describe("bonusesDateExpr", () => {
  it("shipped_date uses COALESCE shipped/delivered", () => {
    const s = bonusesDateExpr("shipped_date").strings.join("");
    expect(s).toMatch(/COALESCE/i);
    expect(s).toMatch(/shipped_at/);
    expect(s).toMatch(/delivered_at/);
  });

  it("created_at uses o.created_at", () => {
    const s = bonusesDateExpr("created_at").strings.join("");
    expect(s).toMatch(/created_at/);
    expect(s).not.toMatch(/COALESCE/i);
  });
});

describe("bonuses-report parseBonusesReportQuery", () => {
  it("defaults empty filters, product group, created_at date", () => {
    const f = parseBonusesReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.group_by).toBe("product");
    expect(f.date_type).toBe("created_at");
    expect(f.statuses).toEqual([]);
    expect(f.agent_ids).toEqual([]);
    expect(f.category_ids).toEqual([]);
  });

  it("parses date range, group, and multi filters", () => {
    const f = parseBonusesReportQuery({
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
    const f = parseBonusesReportQuery({
      date_type: "bogus",
      group_by: "warehouse"
    });
    expect(f.date_type).toBe("created_at");
    expect(f.group_by).toBe("product");
  });
});
