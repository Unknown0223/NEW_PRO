import { describe, expect, it } from "vitest";
import {
  parseOutletClassBands,
  parseOutletClassReportQuery
} from "../src/modules/reports/outlet-class-report.parse";

describe("outlet-class parseOutletClassBands", () => {
  it("defaults A/B/C/D bands", () => {
    const b = parseOutletClassBands(undefined);
    expect(b[0]?.name).toBe("A");
    expect(b[0]?.min_sum).toBe(1_000_000);
    expect(b.at(-1)?.name).toBe("D");
  });

  it("parses and sorts descending", () => {
    const b = parseOutletClassBands("C:100,A:1000,B:500");
    expect(b.map((x) => x.name)).toEqual(["A", "B", "C"]);
    expect(b[0]?.min_sum).toBe(1000);
  });
});

describe("outlet-class parseOutletClassReportQuery", () => {
  it("defaults client group_by", () => {
    const f = parseOutletClassReportQuery({});
    expect(f.group_by).toBe("client");
    expect(f.page).toBe(1);
    expect(f.agent_ids).toEqual([]);
    expect(f.bands.length).toBeGreaterThan(0);
  });

  it("parses filters", () => {
    const f = parseOutletClassReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      group_by: "class",
      bands: "Gold:2000000,Silver:0",
      statuses: "delivered",
      agent_ids: "1,2",
      client_categories: "A",
      territory_1_list: "Zone",
      search: "  shop  ",
      page: "3",
      limit: "40"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.group_by).toBe("class");
    expect(f.bands).toEqual([
      { name: "Gold", min_sum: 2_000_000 },
      { name: "Silver", min_sum: 0 }
    ]);
    expect(f.statuses).toEqual(["delivered"]);
    expect(f.agent_ids).toEqual([1, 2]);
    expect(f.client_categories).toEqual(["A"]);
    expect(f.territory_1_list).toEqual(["Zone"]);
    expect(f.search).toBe("shop");
    expect(f.page).toBe(3);
    expect(f.limit).toBe(40);
  });
});
