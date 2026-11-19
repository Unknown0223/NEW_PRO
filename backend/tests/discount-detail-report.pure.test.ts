import { describe, expect, it } from "vitest";
import { parseDiscountDetailReportQuery } from "../src/modules/reports/discount-detail-report.service";
import { parseUniversalDiscountsReportQuery } from "../src/modules/reports/universal-discounts-report.service";

describe("discount-detail parseDiscountDetailReportQuery", () => {
  it("defaults month range and pagination", () => {
    const f = parseDiscountDetailReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(f.agent_ids).toEqual([]);
    expect(f.search).toBeUndefined();
  });

  it("parses filters", () => {
    const f = parseDiscountDetailReportQuery({
      from: "2026-10-01",
      to: "2026-10-31",
      agent_ids: "1,2",
      search: "  Z-100  ",
      page: "3",
      limit: "100"
    });
    expect(f.from).toBe("2026-10-01");
    expect(f.to).toBe("2026-10-31");
    expect(f.agent_ids).toEqual([1, 2]);
    expect(f.search).toBe("Z-100");
    expect(f.page).toBe(3);
    expect(f.limit).toBe(100);
  });

  it("universal-discounts reuses same parser", () => {
    const a = parseDiscountDetailReportQuery({ agent_ids: "5" });
    const b = parseUniversalDiscountsReportQuery({ agent_ids: "5" });
    expect(b).toEqual(a);
  });
});