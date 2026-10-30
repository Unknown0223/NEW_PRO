import { describe, expect, it } from "vitest";
import {
  filterTerritoryRefsByAgentCities,
  filterWarehousesByScope,
  resolveIdsPreferBindings
} from "../src/modules/linkage/workplace-bindings";

describe("workplace-bindings", () => {
  it("bindings win over order history warehouses", () => {
    expect(resolveIdsPreferBindings([1, 2], [2, 9, 10])).toEqual([1, 2]);
    expect(resolveIdsPreferBindings([], [9, 10])).toEqual([9, 10]);
    expect(resolveIdsPreferBindings([0, -1], [5])).toEqual([5]);
  });

  it("agent with empty warehouse bindings gets [] not full catalog", () => {
    const all = [
      { id: 1, name: "A" },
      { id: 2, name: "B" }
    ];
    expect(
      filterWarehousesByScope({
        warehouses: all,
        constrained: true,
        warehouseIds: [],
        selectedAgentId: 42
      })
    ).toEqual([]);
    expect(
      filterWarehousesByScope({
        warehouses: all,
        constrained: true,
        warehouseIds: [2],
        selectedAgentId: 42
      })
    ).toEqual([{ id: 2, name: "B" }]);
    expect(
      filterWarehousesByScope({
        warehouses: all,
        constrained: false,
        warehouseIds: []
      })
    ).toEqual(all);
  });

  it("filters territory refs to agent cities only", () => {
    const refs = {
      regions: ["Andijon", "Toshkent"],
      zones: ["Z1", "Z2"],
      cities: ["Asaka", "Chilonzor", "Xorazm"],
      territory_cascade: {
        "Z1|Andijon": ["Asaka", "Other"],
        "Z2|Toshkent": ["Chilonzor"]
      },
      extra: true
    };
    const filtered = filterTerritoryRefsByAgentCities(refs, [
      { value: "Asaka", label: "Asaka", zone: "Z1", region: "Andijon" }
    ]);
    expect(filtered.regions).toEqual([]);
    expect(filtered.zones).toEqual(["Z1"]);
    expect(filtered.cities).toEqual(["Asaka"]);
    expect(filtered.territory_cascade).toEqual({ "Z1|Andijon": ["Asaka"] });
    expect(filtered.extra).toBe(true);
  });

  it("clears regions when agent cities empty", () => {
    const refs = {
      regions: ["Andijon", "Toshkent"],
      zones: ["Z1"],
      cities: ["Asaka"]
    };
    const filtered = filterTerritoryRefsByAgentCities(refs, []);
    expect(filtered.regions).toEqual([]);
    expect(filtered.zones).toEqual(["Z1"]);
    expect(filtered.cities).toEqual(["Asaka"]);
  });
});
