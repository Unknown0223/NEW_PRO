import { describe, expect, it } from "vitest";
import { parsePricesReportQuery } from "../src/modules/reports/prices-report.parse";

describe("prices-report parsePricesReportQuery", () => {
  it("defaults page/limit and empty filters", () => {
    const f = parsePricesReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.price_types).toEqual([]);
    expect(f.category_ids).toEqual([]);
    expect(f.brand_ids).toEqual([]);
    expect(f.product_ids).toEqual([]);
    expect(f.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses filters", () => {
    const f = parsePricesReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      price_types: "retail,wholesale",
      category_ids: "1,2",
      brand_ids: "5",
      product_ids: "10,11",
      search: "  milk  ",
      page: "2",
      limit: "80"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.price_types).toEqual(["retail", "wholesale"]);
    expect(f.category_ids).toEqual([1, 2]);
    expect(f.brand_ids).toEqual([5]);
    expect(f.product_ids).toEqual([10, 11]);
    expect(f.search).toBe("milk");
    expect(f.page).toBe(2);
    expect(f.limit).toBe(80);
  });
});
