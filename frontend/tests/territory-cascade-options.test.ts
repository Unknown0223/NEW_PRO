import { describe, expect, it } from "vitest";
import { buildZoneRegionCityCascadeOptions, buildTerritoryTreeOnlyCascade } from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { tradeDirectionFilterLabels } from "@/lib/catalog-filter-options";

function node(name: string, children: TerritoryNode[] = []): TerritoryNode {
  return {
    id: name,
    name,
    active: true,
    children
  };
}

const tree: TerritoryNode[] = [
  node("FV", [
    node("ANDIJON VILOYATI", [node("Asaka"), node("Andijon")]),
    node("NAMANGAN VILOYATI", [node("Namangan")])
  ]),
  node("SOUTH-WEST", [
    node("BUXORO VILOYATI", [node("Buxoro")]),
    node("SAMARQAND VILOYATI", [node("Samarqand")])
  ])
];

describe("buildZoneRegionCityCascadeOptions", () => {
  it("with zone selected, regions are subset of that zone (no unrelated refs dilution)", () => {
    const opts = buildZoneRegionCityCascadeOptions(
      {
        zones: ["FV", "SOUTH-WEST"],
        regions: ["ANDIJON VILOYATI", "BUXORO VILOYATI", "SAMARQAND VILOYATI", "NAMANGAN VILOYATI"],
        cities: ["Asaka", "Buxoro", "Samarqand", "Namangan"],
        region_options: [
          { value: "ANDIJON VILOYATI", label: "ANDIJON VILOYATI" },
          { value: "BUXORO VILOYATI", label: "BUXORO VILOYATI" }
        ],
        city_options: [
          { value: "AD_ASAKA", label: "Asaka" },
          { value: "Buxoro", label: "Buxoro" }
        ]
      },
      {
        zones: ["FV"],
        regions: ["ANDIJON VILOYATI", "BUXORO VILOYATI"],
        cities: ["Asaka", "Buxoro"],
        districts: [],
        neighborhoods: [],
        branches: []
      },
      tree,
      { zone: "FV", region: "", city: "" }
    );

    const regionValues = opts.regions.map((o) => o.value);
    expect(regionValues).toContain("ANDIJON VILOYATI");
    expect(regionValues).toContain("NAMANGAN VILOYATI");
    expect(regionValues).not.toContain("BUXORO VILOYATI");
    expect(regionValues).not.toContain("SAMARQAND VILOYATI");
  });

  it("with zone+region selected, cities stay under that path", () => {
    const opts = buildZoneRegionCityCascadeOptions(
      {
        cities: ["Asaka", "Buxoro", "Samarqand", "Namangan"],
        city_options: [
          { value: "Asaka", label: "Asaka" },
          { value: "Buxoro", label: "Buxoro" }
        ]
      },
      { cities: ["Asaka", "Buxoro"], regions: [], districts: [], zones: [], neighborhoods: [], branches: [] },
      tree,
      { zone: "FV", region: "ANDIJON VILOYATI", city: "" }
    );

    const cityValues = opts.cities.map((o) => o.value);
    expect(cityValues).toContain("Asaka");
    expect(cityValues).toContain("Andijon");
    expect(cityValues).not.toContain("Buxoro");
    expect(cityValues).not.toContain("Namangan");
  });

  it("tree-only cascade does not keep region outside selected zone (prune clears stale)", () => {
    const opts = buildZoneRegionCityCascadeOptions(
      { regions: ["BUXORO VILOYATI"] },
      undefined,
      tree,
      { zone: "FV", region: "BUXORO VILOYATI", city: "" }
    );
    expect(opts.regions.some((o) => o.value === "BUXORO VILOYATI")).toBe(false);
    expect(opts.regions.some((o) => o.value === "ANDIJON VILOYATI")).toBe(true);
  });

  it("pipe-separated zones union regions from each zone", () => {
    const opts = buildZoneRegionCityCascadeOptions(undefined, undefined, tree, {
      zone: "FV|SOUTH-WEST",
      region: "",
      city: ""
    });
    const regionValues = opts.regions.map((o) => o.value);
    expect(regionValues).toContain("ANDIJON VILOYATI");
    expect(regionValues).toContain("BUXORO VILOYATI");
  });

  it("without zone, regions include full refs union", () => {
    const opts = buildZoneRegionCityCascadeOptions(
      { regions: ["BUXORO VILOYATI", "ANDIJON VILOYATI"] },
      undefined,
      tree,
      { zone: "", region: "", city: "" }
    );
    const regionValues = opts.regions.map((o) => o.value);
    expect(regionValues).toContain("BUXORO VILOYATI");
    expect(regionValues).toContain("ANDIJON VILOYATI");
  });

  it("oblast change filters cities under that region (staff expeditor/agent pattern)", () => {
    const all = buildTerritoryTreeOnlyCascade(tree, { zones: [], regions: [] });
    expect(all.cities.map((c) => c.value)).toEqual(
      expect.arrayContaining(["Asaka", "Andijon", "Namangan", "Buxoro", "Samarqand"])
    );

    const underAndijon = buildTerritoryTreeOnlyCascade(tree, {
      zones: [],
      regions: ["ANDIJON VILOYATI"]
    });
    const cities = underAndijon.cities.map((c) => c.value);
    expect(cities).toContain("Asaka");
    expect(cities).toContain("Andijon");
    expect(cities).not.toContain("Buxoro");
    expect(cities).not.toContain("Namangan");
  });
});

describe("tradeDirectionFilterLabels", () => {
  it("prefers name over code for display", () => {
    expect(
      tradeDirectionFilterLabels([
        { name: "Розница", code: "RETAIL", is_active: true },
        { name: "Опт", code: "WHOLESALE", is_active: true }
      ])
    ).toEqual(["Опт", "Розница"]);
  });
});
