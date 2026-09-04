import { describe, expect, it } from "vitest";
import {
  buildTerritoryTreeOnlyCascade,
  buildZoneRegionCityCascadeOptions,
  expandTerritoryTreeDescendants
} from "../lib/territory-client-filters";
import type { TerritoryNode } from "../lib/territory-tree";
import {
  EMPTY_LOCATION_BULK_MODES,
  emptyLocationValues,
  validateBulkTerritorySet,
  type WorkSlotsLocationValues
} from "../components/work-slots/work-slots-location-fields";

const emptyLocation = (): WorkSlotsLocationValues => emptyLocationValues();

/** Haqiqiy tenant daraxti: FV → ANDIJON VILOYATI → tumanlar */
const fvTree: TerritoryNode[] = [
  {
    id: "fv",
    name: "FV",
    active: true,
    children: [
      {
        id: "o1",
        name: "ANDIJON VILOYATI",
        active: true,
        children: [
          { id: "c1", name: "ASAKA", active: true, children: [] },
          { id: "c2", name: "BALIQCHI", active: true, children: [] },
          { id: "c3", name: "ANDIJON TUMANI", active: true, children: [] }
        ]
      },
      {
        id: "o2",
        name: "FARGONA VILOYATI",
        active: true,
        children: [{ id: "c4", name: "QUVASOY", active: true, children: [] }]
      }
    ]
  },
  {
    id: "sw",
    name: "SOUTH-WEST",
    active: true,
    children: []
  }
];

describe("territory tree cascade (FV → oblast → city)", () => {
  it("zones are tree roots only — not refs.zones like Andijon", () => {
    const c = buildZoneRegionCityCascadeOptions(
      { zones: ["Andijon", "Fargona", "Namangan"] },
      undefined,
      fvTree,
      { zone: "", region: "", city: "" }
    );
    const zoneValues = c.zones.map((z) => z.value);
    expect(zoneValues).toContain("FV");
    expect(zoneValues).toContain("SOUTH-WEST");
    expect(zoneValues).not.toContain("Andijon");
    expect(zoneValues).not.toContain("Fargona");
  });

  it("selecting FV shows ANDIJON VILOYATI and FARGONA VILOYATI", () => {
    const c = buildTerritoryTreeOnlyCascade(fvTree, { zones: ["FV"], regions: [] });
    expect(c.regions.map((r) => r.value)).toEqual([
      "ANDIJON VILOYATI",
      "FARGONA VILOYATI"
    ]);
    expect(c.cities.map((x) => x.value).sort()).toEqual([
      "ANDIJON TUMANI",
      "ASAKA",
      "BALIQCHI",
      "QUVASOY"
    ]);
  });

  it("selecting ANDIJON VILOYATI shows only its cities", () => {
    const c = buildTerritoryTreeOnlyCascade(fvTree, {
      zones: ["FV"],
      regions: ["ANDIJON VILOYATI"]
    });
    expect(c.cities.map((x) => x.value).sort()).toEqual([
      "ANDIJON TUMANI",
      "ASAKA",
      "BALIQCHI"
    ]);
    expect(c.cities.map((x) => x.value)).not.toContain("QUVASOY");
  });

  it("expandTerritoryTreeDescendants auto-fills oblasts and cities under FV", () => {
    const { regions, cities } = expandTerritoryTreeDescendants(fvTree, ["FV"], []);
    expect(regions).toContain("ANDIJON VILOYATI");
    expect(regions).toContain("FARGONA VILOYATI");
    expect(cities).toContain("ASAKA");
    expect(cities).toContain("QUVASOY");
  });

  it("expand under one oblast only", () => {
    const { cities } = expandTerritoryTreeDescendants(fvTree, ["FV"], ["ANDIJON VILOYATI"]);
    expect(cities.sort()).toEqual(["ANDIJON TUMANI", "ASAKA", "BALIQCHI"]);
  });
});

describe("bulk territory validation", () => {
  it("allows zone+oblast without city", () => {
    const modes = EMPTY_LOCATION_BULK_MODES();
    modes.territoryZone = "set";
    modes.territoryOblast = "set";
    modes.territoryCity = "set";
    const values = emptyLocation();
    values.territoryZoneList = ["FV"];
    values.territoryOblastList = ["ANDIJON VILOYATI"];
    expect(validateBulkTerritorySet(values, modes)).toBeNull();
  });

  it("never returns Город error when zone is set", () => {
    const modes = EMPTY_LOCATION_BULK_MODES();
    modes.territoryZone = "set";
    modes.territoryOblast = "set";
    modes.territoryCity = "set";
    const values = emptyLocation();
    values.territoryZoneList = ["FV"];
    const err = validateBulkTerritorySet(values, modes);
    expect(err).toBeNull();
  });
});
