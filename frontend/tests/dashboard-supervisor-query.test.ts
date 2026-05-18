import { describe, expect, it } from "vitest";
import { buildSupervisorDashboardQueryString, type SupervisorDashboardQueryInput } from "@/lib/dashboard-supervisor-query";

const base = (): SupervisorDashboardQueryInput => ({
  date: "2026-05-06",
  payment_types: [],
  agent_ids: [],
  supervisor_ids: [],
  trade_directions: [],
  client_categories: [],
  territory_1_list: [],
  territory_2_list: [],
  territory_3_list: []
});

describe("buildSupervisorDashboardQueryString", () => {
  it("doim date qo‘shadi", () => {
    expect(buildSupervisorDashboardQueryString(base())).toBe("date=2026-05-06");
  });

  it("faqat to‘ldirilgan filtrlarni yuboradi (ko‘p tanlov — vergul)", () => {
    const s = buildSupervisorDashboardQueryString({
      ...base(),
      payment_types: ["cash", "card"],
      agent_ids: ["12", "5"],
      supervisor_ids: ["3"],
      trade_directions: ["opt", "rozn"],
      client_categories: ["retail", "horeca"],
      territory_1_list: ["Z1", "Z2"],
      territory_2_list: ["A", "B"],
      territory_3_list: ["C"]
    });
    const q = new URLSearchParams(s);
    expect(q.get("date")).toBe("2026-05-06");
    expect(q.get("payment_type")).toBe("card,cash");
    expect(q.get("agent_ids")).toBe("12,5");
    expect(q.get("supervisor_ids")).toBe("3");
    expect(q.get("trade_direction")).toBe("opt,rozn");
    expect(q.get("client_category")).toBe("horeca,retail");
    expect(q.get("territory_1")).toBe("Z1,Z2");
    expect(q.get("territory_2")).toBe("A,B");
    expect(q.get("territory_3")).toBe("C");
  });
});
