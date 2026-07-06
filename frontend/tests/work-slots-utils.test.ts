import { describe, expect, it } from "vitest";
import {
  activeStatusListToQuery,
  buildWorkSlotsQuery,
  parseUserTerritoryParts,
  slotTypeLabel,
  staffApiPath
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
});
