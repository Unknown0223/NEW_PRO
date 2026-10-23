import { describe, expect, it } from "vitest";
import { expandPermissionKeyAliases, mapLegacyKeyToStructured } from "../src/modules/access/legacy-key-map";
import { buildScopedAgentWhere } from "../src/modules/access/access-agent-scope";
import { applyDeniedPermissionKeys } from "../src/modules/access/rbac.resolve";

describe("applyDeniedPermissionKeys — mayda deny umumiy view ni yopmasin", () => {
  it("spisok_agentov allow + konfiguratsii deny → staff.agent.view qoladi", () => {
    const eff = new Set(expandPermissionKeyAliases(["staff.agent.spisok_agentov", "staff.agent.konfiguratsii"]));
    applyDeniedPermissionKeys(eff, new Set(["staff.agent.konfiguratsii"]));
    expect(eff.has("staff.agent.view")).toBe(true);
    expect(eff.has("staff.agent.spisok_agentov")).toBe(true);
    expect(eff.has("staff.agent.konfiguratsii")).toBe(false);
  });

  it("view ni qo‘llovchi boshqa kalit bo‘lmasa — alias ham o‘chadi", () => {
    const eff = new Set(expandPermissionKeyAliases(["staff.agent.konfiguratsii"]));
    applyDeniedPermissionKeys(eff, new Set(["staff.agent.konfiguratsii"]));
    expect(eff.has("staff.agent.view")).toBe(false);
  });

  it("to‘g‘ridan-to‘g‘ri view deny — har doim o‘chadi", () => {
    const eff = new Set(expandPermissionKeyAliases(["staff.agent.spisok_agentov"]));
    applyDeniedPermissionKeys(eff, new Set(["staff.agent.view"]));
    expect(eff.has("staff.agent.view")).toBe(false);
  });
});

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

  it("dashboard section view sibling `dashboard.view` ni ochmaydi", () => {
    expect(expandPermissionKeyAliases(["dashboard.supervayzer.view"])).toEqual(
      expect.arrayContaining(["dashboard.supervayzer.view", "dashboard.supervayzer"])
    );
    expect(expandPermissionKeyAliases(["dashboard.supervayzer.view"])).not.toContain("dashboard.view");
    expect(expandPermissionKeyAliases(["dashboard.supervayzer"])).toEqual(
      expect.arrayContaining(["dashboard.supervayzer", "dashboard.supervayzer.view"])
    );
    expect(expandPermissionKeyAliases(["dashboard.view"])).toContain("dashboard.view");
  });

  it("orders.view ↔ orders.zakaz.view companion", () => {
    expect(expandPermissionKeyAliases(["orders.view"])).toContain("orders.zakaz.view");
    expect(expandPermissionKeyAliases(["orders.zakaz.view"])).toContain("orders.view");
  });
});

describe("buildScopedAgentWhere — Access Сотрудники bog‘lanishi", () => {
  it("supervisor + bound agentlar: faqat shular", () => {
    expect(
      buildScopedAgentWhere(1, { userId: 10, role: "supervisor", bound_agent_ids: [101, 102] })
    ).toEqual({
      tenant_id: 1,
      role: "agent",
      id: { in: [101, 102] },
      is_active: true
    });
  });

  it("supervisor bindsiz: bo‘sh", () => {
    expect(buildScopedAgentWhere(1, { userId: 10, role: "supervisor", bound_agent_ids: [] })).toEqual({
      tenant_id: 1,
      role: "agent",
      id: { in: [] },
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
