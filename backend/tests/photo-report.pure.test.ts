import { describe, expect, it } from "vitest";
import { parsePhotoReportQuery } from "../src/modules/reports/photo-report.parse";

describe("photo-report parsePhotoReportQuery", () => {
  it("defaults archive to active and empty multi filters", () => {
    const f = parsePhotoReportQuery({});
    expect(f.archive).toBe("active");
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.photo_categories).toEqual([]);
    expect(f.user_ids).toEqual([]);
    expect(f.user_roles).toEqual([]);
  });

  it("parses date range, archive void, and multi filters", () => {
    const f = parsePhotoReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      archive: "void",
      photo_categories: "Полка,Витрина",
      user_ids: "3,8",
      user_roles: "agent,expeditor",
      client_categories: "A,B",
      territory_3_list: "ASAKA",
      client_active: "active",
      search: "  market  ",
      page: "2",
      limit: "100"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.archive).toBe("void");
    expect(f.photo_categories).toEqual(["Полка", "Витрина"]);
    expect(f.user_ids).toEqual([3, 8]);
    expect(f.user_roles).toEqual(["agent", "expeditor"]);
    expect(f.client_categories).toEqual(["A", "B"]);
    expect(f.territory_3_list).toEqual(["ASAKA"]);
    expect(f.client_active).toBe("active");
    expect(f.search).toBe("market");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(100);
  });

  it("rejects unknown archive and client_active to defaults", () => {
    const f = parsePhotoReportQuery({ archive: "maybe", client_active: "huh" });
    expect(f.archive).toBe("active");
    expect(f.client_active).toBe("all");
  });
});
