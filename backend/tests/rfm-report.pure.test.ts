import { describe, expect, it } from "vitest";
import { parseRfmReportQuery, scoreRfmQuintiles } from "../src/modules/reports/rfm-report.parse";

describe("rfm parseRfmReportQuery", () => {
  it("defaults page and filters", () => {
    const f = parseRfmReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.agent_ids).toEqual([]);
    expect(f.client_categories).toEqual([]);
    expect(f.territory_1_list).toEqual([]);
  });

  it("parses filters", () => {
    const f = parseRfmReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      agent_ids: "3,7",
      client_categories: "A,B",
      territory_1_list: "Z1",
      territory_2_list: "R1",
      territory_3_list: "C1",
      search: "  shop ",
      page: "2",
      limit: "25"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.agent_ids).toEqual([3, 7]);
    expect(f.client_categories).toEqual(["A", "B"]);
    expect(f.territory_1_list).toEqual(["Z1"]);
    expect(f.territory_2_list).toEqual(["R1"]);
    expect(f.territory_3_list).toEqual(["C1"]);
    expect(f.search).toBe("shop");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(25);
  });
});

describe("rfm scoreRfmQuintiles", () => {
  it("higher is better — top values get 5", () => {
    const scores = scoreRfmQuintiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], true);
    expect(scores[9]).toBe(5);
    expect(scores[0]).toBe(1);
  });

  it("lower is better — smallest values get 5", () => {
    const scores = scoreRfmQuintiles([10, 20, 30, 40, 50], false);
    expect(scores[0]).toBe(5);
    expect(scores[4]).toBe(1);
  });

  it("empty input", () => {
    expect(scoreRfmQuintiles([], true)).toEqual([]);
  });
});