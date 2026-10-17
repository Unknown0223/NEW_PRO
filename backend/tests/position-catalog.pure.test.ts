import { describe, expect, it } from "vitest";
import {
  activePresetLabels,
  activePresetsForRole,
  type WebStaffPositionPresetDto
} from "../src/modules/staff/staff.patches.web-presets.store";
import {
  isPositionCatalogRole,
  positionCatalogRoleLabelRu
} from "../src/modules/staff/position-catalog.roles";

function preset(partial: Partial<WebStaffPositionPresetDto> & { id: string; label: string }): WebStaffPositionPresetDto {
  return {
    role: null,
    code: null,
    comment: null,
    is_active: true,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    created_by_user_id: null,
    deactivated_at: null,
    deactivated_by_user_id: null,
    ...partial
  };
}

describe("position catalog roles", () => {
  it("accepts screenshot roles", () => {
    expect(isPositionCatalogRole("agent")).toBe(true);
    expect(isPositionCatalogRole("expeditor")).toBe(true);
    expect(isPositionCatalogRole("operator")).toBe(true);
    expect(isPositionCatalogRole("nope")).toBe(false);
    expect(positionCatalogRoleLabelRu("agent")).toBe("Агент");
  });
});

describe("activePresetsForRole", () => {
  const rows = [
    preset({ id: "a", label: "AGENT", role: "agent", sort_order: 1 }),
    preset({ id: "b", label: "Kassir", role: "cashier", sort_order: 2 }),
    preset({ id: "c", label: "Legacy", role: null, sort_order: 0 }),
    preset({ id: "d", label: "Off", role: "agent", is_active: false, sort_order: 3 })
  ];

  it("filters by role and keeps unscoped", () => {
    const out = activePresetsForRole(rows, "agent");
    expect(out.map((p) => p.label)).toEqual(["Legacy", "AGENT"]);
  });

  it("active labels ignore inactive", () => {
    expect(activePresetLabels(rows)).toEqual(["AGENT", "Kassir", "Legacy"]);
  });
});
