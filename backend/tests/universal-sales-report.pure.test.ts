import { describe, expect, it } from "vitest";
import { parseUniversalSalesReportQuery } from "../src/modules/reports/universal-sales-report.service";

describe("universal-sales parseUniversalSalesReportQuery", () => {
  it("defaults pagination and order_date", () => {
    const f = parseUniversalSalesReportQuery({});
    expect(f.page).toBe(1);
    expect(f.limit).toBe(50);
    expect(f.date_type).toBe("order_date");
    expect(f.sort_by).toBe("name");
    expect(f.agent_ids).toEqual([]);
  });

  it("parses agent and date filters", () => {
    const f = parseUniversalSalesReportQuery({
      from: "2026-11-01",
      to: "2026-11-19",
      date_type: "delivered_date",
      agent_ids: "3,7",
      page: "2",
      limit: "25"
    });
    expect(f.from).toBe("2026-11-01");
    expect(f.to).toBe("2026-11-19");
    expect(f.date_type).toBe("delivered_date");
    expect(f.agent_ids).toEqual([3, 7]);
    expect(f.page).toBe(2);
    expect(f.limit).toBe(25);
  });
});