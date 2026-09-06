import { describe, expect, it } from "vitest";
import { buildCityTerritoryHints } from "../src/modules/tenant-settings/tenant-settings.territory";
import { resolveTerritoryFromCityHints } from "../src/modules/clients/clients.territory-sync";

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
