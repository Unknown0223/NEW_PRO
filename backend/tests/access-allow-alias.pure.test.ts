import { describe, expect, it } from "vitest";
import { expandPermissionKeyAliases, mapLegacyKeyToStructured } from "../src/modules/access/legacy-key-map";
import { buildScopedAgentWhere } from "../src/modules/access/access-agent-scope";

describe("expandPermissionKeyAliases — allow/deny juftliklar", () => {
  it("legacy staff.agent.spisok_agentov → staff.agent.view (nav kaliti)", () => {
    expect(mapLegacyKeyToStructured("staff.agent.spisok_agentov")).toBe("staff.agent.view");
    const expanded = expandPermissionKeyAliases(["staff.agent.spisok_agentov"]);
    expect(expanded).toContain("staff.agent.spisok_agentov");
    expect(expanded).toContain("staff.agent.view");
  });

  it("structured staff.agent.activate deny MUST NOT wipe staff.agent.view", () => {
    const expanded = expandPermissionKeyAliases(["staff.agent.activate", "staff.agent.create"]);
    expect(expanded).toContain("staff.agent.activate");
    expect(expanded).toContain("staff.agent.create");
    expect(expanded).not.toContain("staff.agent.view");
  });

  it("legacy prosmotr_agenta → staff.agent.view", () => {
    const expanded = expandPermissionKeyAliases(["staff.agent.prosmotr_agenta"]);
    expect(expanded).toContain("staff.agent.view");
  });

  it("dashboard structured ↔ legacy simmetrik", () => {
    expect(expandPermissionKeyAliases(["dashboard.supervayzer.view"])).toEqual(
      expect.arrayContaining(["dashboard.supervayzer.view", "dashboard.supervayzer", "dashboard.view"])
    );
    expect(expandPermissionKeyAliases(["dashboard.supervayzer"])).toEqual(
      expect.arrayContaining(["dashboard.supervayzer", "dashboard.supervayzer.view", "dashboard.view"])
    );
  });

  it("orders.view ↔ orders.zakaz.view companion", () => {
    expect(expandPermissionKeyAliases(["orders.view"])).toContain("orders.zakaz.view");
    expect(expandPermissionKeyAliases(["orders.zakaz.view"])).toContain("orders.view");
  });
});

describe("buildScopedAgentWhere — Access Сотрудники bog‘lanishi", () => {
  it("supervisor: faqat o‘z agentlari", () => {
    expect(buildScopedAgentWhere(1, { userId: 10, role: "supervisor" })).toEqual({
      tenant_id: 1,
      role: "agent",
      supervisor_user_id: 10,
      is_active: true
    });
  });

  it("operator + bound agents: faqat bog‘langanlar", () => {
    expect(
      buildScopedAgentWhere(1, {
        userId: 5,
        role: "operator",
        bound_agent_ids: [101, 102]
      })
    ).toEqual({
      tenant_id: 1,
      role: "agent",
      id: { in: [101, 102] },
      is_active: true
    });
  });

  it("operator bindsiz: bo‘sh (Access Сотрудники)", () => {
    expect(buildScopedAgentWhere(1, { userId: 5, role: "operator", bound_agent_ids: [] })).toEqual({
      tenant_id: 1,
      role: "agent",
      id: { in: [] },
      is_active: true
    });
  });
});
