import { describe, expect, it } from "vitest";
import { RES_AGENT_KPI, RES_TEAM_KPI, RES_THRESHOLD, RES_CAP } from "../src/modules/payroll/payroll.preset.pure";

describe("RES preset formula constants", () => {
  it("RES_THRESHOLD = 60.9", () => {
    expect(RES_THRESHOLD).toBe(60.9);
  });

  it("RES_CAP = 120", () => {
    expect(RES_CAP).toBe(120);
  });

  it("RES_AGENT_KPI formula contains KPI - Выполнение (%) variable", () => {
    expect(RES_AGENT_KPI).toContain("KPI - Выполнение (%)");
    expect(RES_AGENT_KPI).toContain("ЕСЛИ");
    expect(RES_AGENT_KPI).toContain("MIN");
  });

  it("RES_TEAM_KPI formula contains Команда - Выполнение (%) variable", () => {
    expect(RES_TEAM_KPI).toContain("Команда - Выполнение (%)");
    expect(RES_TEAM_KPI).toContain("ЕСЛИ");
    expect(RES_TEAM_KPI).toContain("MIN");
  });

  it("both use same threshold and cap", () => {
    expect(RES_AGENT_KPI).toContain(`${RES_THRESHOLD}`);
    expect(RES_TEAM_KPI).toContain(`${RES_THRESHOLD}`);
    expect(RES_AGENT_KPI).toContain(`${RES_CAP}`);
    expect(RES_TEAM_KPI).toContain(`${RES_CAP}`);
  });
});

describe("group KPI formula override behavior", () => {
  const testGroupFormula = (groupFormula: string | null, role: "agent" | "supervisor") => {
    if (groupFormula) {
      return groupFormula;
    }
    return role === "agent" ? RES_AGENT_KPI : RES_TEAM_KPI;
  };

  it("agent uses group formula when present", () => {
    const custom = "ЕСЛИ([KPI - Выполнение (%)] >= 50, 500000, 0)";
    const result = testGroupFormula(custom, "agent");
    expect(result).toBe(custom);
  });

  it("agent falls back to RES_AGENT_KPI when group formula is null", () => {
    const result = testGroupFormula(null, "agent");
    expect(result).toBe(RES_AGENT_KPI);
  });

  it("supervisor uses group formula when present", () => {
    const custom = "ЕСЛИ([Команда - Выполнение (%)] >= 70, 300000, 0)";
    const result = testGroupFormula(custom, "supervisor");
    expect(result).toBe(custom);
  });

  it("supervisor falls back to RES_TEAM_KPI when group formula is null", () => {
    const result = testGroupFormula(null, "supervisor");
    expect(result).toBe(RES_TEAM_KPI);
  });
});
