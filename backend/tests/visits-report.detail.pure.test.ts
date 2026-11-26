import { describe, expect, it } from "vitest";
import { parseVisitsDetailQuery, VISITS_DETAIL_TYPES } from "../src/modules/reports/visits-report.parse";
import { getVisitsReportDetail, VISITS_DETAIL_CAP } from "../src/modules/reports/visits-report.detail";

describe("visits detail parse", () => {
  it("allowlist has six SalesDoc types", () => {
    expect([...VISITS_DETAIL_TYPES].sort()).toEqual(
      ["not_visited", "okb", "only_order", "only_photo", "rejected", "visited"].sort()
    );
  });

  it("exports detail loader and cap", () => {
    expect(typeof getVisitsReportDetail).toBe("function");
    expect(VISITS_DETAIL_CAP).toBe(2000);
  });

  it("maps empty type to okb and requires agent_id", () => {
    const f = parseVisitsDetailQuery({
      from: "2026-11-01",
      to: "2026-11-30",
      agent_id: "42",
      type: ""
    });
    expect(f.type).toBe("okb");
    expect(f.agent_id).toBe(42);
    expect(f.from).toBe("2026-11-01");
  });

  it("accepts only_order / visited", () => {
    expect(parseVisitsDetailQuery({ agent_id: "7", type: "only_order" }).type).toBe("only_order");
    expect(parseVisitsDetailQuery({ agent_id: "7", type: "visited" }).type).toBe("visited");
  });

  it("rejects unknown type", () => {
    expect(() => parseVisitsDetailQuery({ agent_id: "1", type: "nope" })).toThrow(/type/i);
  });

  it("rejects missing agent_id", () => {
    expect(() => parseVisitsDetailQuery({ type: "okb" })).toThrow(/agent/i);
  });
});
