import { describe, expect, it } from "vitest";
import { citiesByZoneRegionFromTerritoryNodes } from "../src/modules/mobile/mobile-territory-references";
import { findCityParentsInTerritoryTree } from "../src/modules/work-slots/work-slots.multi-bindings";

const tree = [
  {
    name: "FV",
    active: true,
    children: [
      {
        name: "ANDIJON VILOYATI",
        active: true,
        children: [
          { name: "ASAKA", active: true, children: [] },
          { name: "BALIQCHI", active: true, children: [] }
        ]
      },
      {
        name: "FARGONA VILOYATI",
        active: true,
        children: [{ name: "QUVASOY", active: true, children: [] }]
      }
    ]
  },
  {
    name: "SOUTH-WEST",
    active: true,
    children: [
      {
        name: "XORAZM VILOYATI",
        active: true,
        children: [{ name: "Bog'ot", active: true, children: [] }]
      }
    ]
  }
];

describe("territory cascade maps", () => {
  it("citiesByZoneRegionFromTerritoryNodes keys zone|||region", () => {
    const map = citiesByZoneRegionFromTerritoryNodes(tree);
    expect(map["FV|||ANDIJON VILOYATI"]).toEqual(["ASAKA", "BALIQCHI"]);
    expect(map["FV|||FARGONA VILOYATI"]).toEqual(["QUVASOY"]);
    expect(map["SOUTH-WEST|||XORAZM VILOYATI"]).toEqual(["Bog'ot"]);
    expect(map["FV|||ANDIJON VILOYATI"]).not.toContain("Bog'ot");
  });

  it("findCityParentsInTerritoryTree resolves real parents", () => {
    expect(findCityParentsInTerritoryTree(tree, "ASAKA")).toEqual({
      zone: "FV",
      oblast: "ANDIJON VILOYATI"
    });
    expect(findCityParentsInTerritoryTree(tree, "Bog'ot")).toEqual({
      zone: "SOUTH-WEST",
      oblast: "XORAZM VILOYATI"
    });
  });
});
