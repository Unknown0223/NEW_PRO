import { describe, expect, it } from "vitest";
import {
  activeStatusListToQuery,
  buildWorkSlotsQuery,
  parseUserTerritoryParts,
  slotTypeLabel,
  slotWorkplaceConfigTabs,
  staffApiPath,
  staffSessionsKind,
  workSlotsDefaultHiddenColumns
} from "../components/work-slots/work-slots-utils";

describe("work-slots-utils", () => {
  it("activeStatusListToQuery maps filter chips to API boolean", () => {
    expect(activeStatusListToQuery(["active"])).toBe(true);
    expect(activeStatusListToQuery(["inactive"])).toBe(false);
    expect(activeStatusListToQuery(["active", "inactive"])).toBeUndefined();
    expect(activeStatusListToQuery([])).toBeUndefined();
  });

  it("staffApiPath maps slot type to staff REST segment", () => {
    expect(staffApiPath("agent")).toBe("agents");
    expect(staffApiPath("collector")).toBe("collectors");
    expect(staffApiPath("expeditor")).toBe("expeditors");
    expect(staffApiPath("skladchik")).toBe("skladchik");
  });

  it("slotTypeLabel returns RU label or raw type", () => {
    expect(slotTypeLabel("agent")).toBe("Агент");
    expect(slotTypeLabel("unknown")).toBe("unknown");
  });

  it("parseUserTerritoryParts splits zone / oblast / city", () => {
    expect(parseUserTerritoryParts("Zona / Viloyat / Shahar")).toEqual({
      zone: "Zona",
      oblast: "Viloyat",
      city: "Shahar"
    });
    expect(parseUserTerritoryParts(null)).toEqual({ zone: null, oblast: null, city: null });
  });

  it("buildWorkSlotsQuery serializes filters", () => {
    const qs = buildWorkSlotsQuery({
      slot_type: "agent",
      branch_codes: ["A", "B"],
      is_active: true,
      q: " T-12 ",
      page: 2,
      limit: 50
    });
    const p = new URLSearchParams(qs);
    expect(p.get("slot_types")).toBe("agent");
    expect(p.get("branch_codes")).toBe("A,B");
    expect(p.get("is_active")).toBe("true");
    expect(p.get("q")).toBe("T-12");
    expect(p.get("page")).toBe("2");
    expect(p.get("limit")).toBe("50");
  });

  it("slotWorkplaceConfigTabs includes mobile for agent, expeditor, supervisor, auditor", () => {
    expect(slotWorkplaceConfigTabs("agent").map((t) => t.id)).toContain("mobile");
    expect(slotWorkplaceConfigTabs("expeditor").map((t) => t.id)).toContain("mobile");
    expect(slotWorkplaceConfigTabs("supervisor").map((t) => t.id)).toContain("mobile");
    expect(slotWorkplaceConfigTabs("auditor").map((t) => t.id)).toContain("mobile");
    expect(slotWorkplaceConfigTabs("skladchik").map((t) => t.id)).not.toContain("mobile");
    expect(slotWorkplaceConfigTabs("collector").map((t) => t.id)).not.toContain("mobile");
  });

  it("slotWorkplaceConfigTabs includes team for supervisor only", () => {
    expect(slotWorkplaceConfigTabs("supervisor").map((t) => t.id)).toContain("team");
    expect(slotWorkplaceConfigTabs("supervisor").find((t) => t.id === "team")?.label).toBe("Команда");
    expect(slotWorkplaceConfigTabs("agent").map((t) => t.id)).not.toContain("team");
    expect(slotWorkplaceConfigTabs("operator").map((t) => t.id)).toEqual(["main"]);
    expect(slotWorkplaceConfigTabs("manager").map((t) => t.id)).toEqual(["main"]);
    expect(slotWorkplaceConfigTabs("director").map((t) => t.id)).toEqual(["main"]);
    expect(slotWorkplaceConfigTabs("sales_director").map((t) => t.id)).toEqual(["main"]);
  });

  it("workSlotsDefaultHiddenColumns keeps bindings visible for director/operator", () => {
    expect(workSlotsDefaultHiddenColumns("director")).toEqual([]);
    expect(workSlotsDefaultHiddenColumns("operator")).toEqual([]);
    expect(workSlotsDefaultHiddenColumns("sales_director")).toEqual(["cash_desk"]);
    expect(workSlotsDefaultHiddenColumns("accountant")).toEqual(["warehouse"]);
  });

  it("slotTypeLabel lists Сотрудники roles separately", () => {
    expect(slotTypeLabel("operator")).toBe("Оператор");
    expect(slotTypeLabel("manager")).toBe("Менеджер");
    expect(slotTypeLabel("director")).toBe("Директор");
    expect(slotTypeLabel("sales_director")).toBe("Директор по продажам");
  });

  it("staffApiPath maps all operator-like slots to operators", () => {
    expect(staffApiPath("operator")).toBe("operators");
    expect(staffApiPath("manager")).toBe("operators");
    expect(staffApiPath("director")).toBe("operators");
  });

  it("staffSessionsKind maps slot type to staff sessions API kind", () => {
    expect(staffSessionsKind("agent")).toBe("agent");
    expect(staffSessionsKind("collector")).toBe("collector");
    expect(staffSessionsKind("expeditor")).toBe("expeditor");
    expect(staffSessionsKind("skladchik")).toBe("skladchik");
    expect(staffSessionsKind("supervisor")).toBe("supervisor");
    expect(staffSessionsKind("auditor")).toBe("auditor");
    expect(staffSessionsKind("operator")).toBe("operator");
    expect(staffSessionsKind("manager")).toBe("operator");
    expect(staffSessionsKind("director")).toBe("operator");
  });
});
