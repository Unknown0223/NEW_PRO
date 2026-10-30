import { describe, expect, it } from "vitest";
import {
  collectTerritoryRenames,
  renameTerritoryBinding
} from "../src/modules/tenant-settings/tenant-settings.territory-rename";

const tree = (regionName: string, regionCode?: string, cityName = "URGUT") => ({
  territory_levels: ["Зона", "Область", "Город"],
  territory_nodes: [
    {
      id: "z1",
      name: "SOUTH-WEST",
      children: [
        {
          id: "r1",
          name: regionName,
          ...(regionCode ? { code: regionCode } : {}),
          children: [{ id: "c1", name: cityName, children: [] }]
        },
        { id: "r2", name: "BUXORO", children: [] }
      ]
    }
  ]
});

describe("collectTerritoryRenames", () => {
  it("detects region rename by node id", () => {
    const renames = collectTerritoryRenames(tree("SAMARQAND"), tree("SAMARQAND VILOYATI"));
    expect(renames).toEqual([{ column: "region", depth: 1, from: "SAMARQAND", to: "SAMARQAND VILOYATI" }]);
  });

  it("detects city rename", () => {
    const renames = collectTerritoryRenames(tree("SAMARQAND"), tree("SAMARQAND", undefined, "URGUT SHAXAR"));
    expect(renames).toEqual([{ column: "city", depth: 2, from: "URGUT", to: "URGUT SHAXAR" }]);
  });

  it("maps old name and old code to new stored value", () => {
    const renames = collectTerritoryRenames(tree("Samarqand", "SAM"), tree("Samarqand viloyati", "SAM_V"));
    expect(renames.map((r) => [r.from, r.to])).toEqual([
      ["SAM", "SAM_V"],
      ["Samarqand", "SAM_V"]
    ]);
  });

  it("returns nothing when tree is unchanged", () => {
    expect(collectTerritoryRenames(tree("SAMARQAND"), tree("SAMARQAND"))).toEqual([]);
  });

  it("skips old value still used by another node at same depth", () => {
    expect(collectTerritoryRenames(tree("BUXORO"), tree("SAMARQAND"))).toEqual([]);
  });
});

describe("renameTerritoryBinding", () => {
  const renames = collectTerritoryRenames(tree("SAMARQAND"), tree("SAMARQAND VILOYATI"));

  it("replaces region segment of compound binding (case-insensitive)", () => {
    expect(renameTerritoryBinding("SOUTH-WEST / Samarqand / URGUT", renames)).toBe(
      "SOUTH-WEST / SAMARQAND VILOYATI / URGUT"
    );
  });

  it("replaces single-segment value", () => {
    expect(renameTerritoryBinding("SAMARQAND", renames)).toBe("SAMARQAND VILOYATI");
  });

  it("does not touch same text at other depth", () => {
    expect(renameTerritoryBinding("SAMARQAND / X / Y", renames)).toBe("SAMARQAND / X / Y");
  });

  it("keeps unrelated values as-is", () => {
    expect(renameTerritoryBinding("SOUTH-WEST/BUXORO", renames)).toBe("SOUTH-WEST/BUXORO");
  });
});
