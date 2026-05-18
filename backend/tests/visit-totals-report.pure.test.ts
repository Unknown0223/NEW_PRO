import { describe, expect, it } from "vitest";
import { parseVisitTotalsQuery } from "../src/modules/reports/visit-totals-report.service";

describe("visit-totals-report parseVisitTotalsQuery", () => {
  it("defaults order_statuses empty", () => {
    const f = parseVisitTotalsQuery({});
    expect(f.order_statuses).toEqual([]);
    expect(f.agent_ids).toEqual([]);
  });

  it("parses agent_ids and order_statuses", () => {
    const f = parseVisitTotalsQuery({
      agent_ids: "3,5",
      order_statuses: "new,delivered,bogus"
    });
    expect(f.agent_ids).toEqual([3, 5]);
    expect(f.order_statuses).toEqual(["new", "delivered"]);
  });
});
