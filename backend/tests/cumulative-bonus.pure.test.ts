import { describe, expect, it } from "vitest";
import { parseCumulativeBonusQuery } from "../src/modules/reports/cumulative-bonus.parse";

describe("cumulative-bonus parseCumulativeBonusQuery", () => {
  it("defaults client group and created_at", () => {
    const f = parseCumulativeBonusQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.group_by).toBe("client");
    expect(f.date_type).toBe("created_at");
    expect(f.bonus_rule_ids).toEqual([]);
    expect(f.agent_ids).toEqual([]);
  });

  it("parses filters and group_by rule", () => {
    const f = parseCumulativeBonusQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      date_type: "shipped_date",
      group_by: "rule",
      statuses: "delivered",
      agent_ids: "3,4",
      bonus_rule_ids: "10,11",
      client_categories: "A",
      territory_1_list: "Andijon",
      search: "  shop  ",
      page: "2",
      limit: "80"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.date_type).toBe("shipped_date");
    expect(f.group_by).toBe("rule");
    expect(f.statuses).toEqual(["delivered"]);
    expect(f.agent_ids).toEqual([3, 4]);
    expect(f.bonus_rule_ids).toEqual([10, 11]);
    expect(f.client_categories).toEqual(["A"]);
    expect(f.territory_1_list).toEqual(["Andijon"]);
    expect(f.search).toBe("shop");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(80);
  });

  it("drops unknown date_type and group_by", () => {
    const f = parseCumulativeBonusQuery({ date_type: "x", group_by: "y" });
    expect(f.date_type).toBe("created_at");
    expect(f.group_by).toBe("client");
  });
});
