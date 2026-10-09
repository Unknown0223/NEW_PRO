import { describe, expect, it } from "vitest";
import { buildCityTerritoryHints } from "../src/modules/tenant-settings/tenant-settings.territory";
import {
  isKnownTerritoryRegion,
  resolveTerritoryFromCityHints
} from "../src/modules/clients/clients.territory-sync";

describe("resolveTerritoryFromCityHints", () => {
  const refs = {
    territory_levels: ["Зона", "Область", "Город"],
    territory_nodes: [
      {
        id: "z1",
        name: "SOUTH-WEST",
        code: "SOUTH-WEST",
        children: [
          {
            id: "r1",
            name: "XORAZM VILOYATI",
            code: "XORAZM_VILOYATI",
            children: [{ id: "c1", name: "URGANCH", code: "URGANCH", children: [] }]
          }
        ]
      }
    ]
  };

  it("buildCityTerritoryHints indexes URGANCH", () => {
    const hints = buildCityTerritoryHints(refs);
    expect(Object.keys(hints).length).toBeGreaterThan(0);
    expect(hints.URGANCH || hints.Urganch || hints.urganch).toBeTruthy();
  });

  it("fills empty region/zone from city", () => {
    const r = resolveTerritoryFromCityHints(refs, "URGANCH", { region: null, zone: null });
    expect(r.region).toBeTruthy();
    expect(String(r.region).toUpperCase()).toContain("XORAZM");
    expect(r.zone).toBeTruthy();
    expect(String(r.zone).toUpperCase()).toContain("SOUTH");
  });

  it("keeps existing region", () => {
    const r = resolveTerritoryFromCityHints(refs, "URGANCH", {
      region: "BUXORO VILOYATI",
      zone: null
    });
    expect(r.region).toBe("BUXORO VILOYATI");
    expect(r.zone).toBeTruthy();
  });

  it("returns empty when city unknown", () => {
    const r = resolveTerritoryFromCityHints(refs, "NO_SUCH_CITY", { region: null, zone: null });
    expect(r.region).toBeNull();
    expect(r.zone).toBeNull();
  });
});

describe("isKnownTerritoryRegion", () => {
  const refs = {
    territory_levels: ["Зона", "Область", "Город"],
    territory_nodes: [
      {
        id: "z1",
        name: "SOUTH-WEST",
        children: [
          {
            id: "r1",
            name: "SAMARQAND VILOYATI",
            children: [{ id: "c1", name: "SM_SHAHAR", code: "SM_SHAHAR", children: [] }]
          },
          { id: "r2", name: "BUXORO VILOYATI", children: [] }
        ]
      }
    ]
  };

  it("accepts tree regions and historical short names", () => {
    expect(isKnownTerritoryRegion(refs, "BUXORO VILOYATI")).toBe(true);
    expect(isKnownTerritoryRegion(refs, "buxoro viloyati")).toBe(true);
    expect(isKnownTerritoryRegion(refs, "SAMARQAND")).toBe(true);
  });

  it("rejects hand-typed text that is not a region", () => {
    expect(isKnownTerritoryRegion(refs, "sputnik")).toBe(false);
    expect(isKnownTerritoryRegion(refs, "sevrni")).toBe(false);
  });

  it("accepts anything when the tenant has no territory tree", () => {
    expect(isKnownTerritoryRegion({}, "sputnik")).toBe(true);
  });
});
