import { describe, expect, it } from "vitest";
import {
  cityKeysMatchingRegionInHints,
  clientWhereForRegionFilter
} from "../src/modules/clients/clients.territory-filter";
import type { CityTerritoryHintDto } from "../src/modules/tenant-settings/tenant-settings.service";
import {
  excelRegionCardPatch,
  zoneForExcelRegion
} from "../src/modules/opening-balances/opening-balances.import.region";

const xorazmHints: Record<string, CityTerritoryHintDto> = {
  XR_URGANCH: {
    city_label: "Urganch",
    region_stored: "XORAZM_VIL",
    region_label: "XORAZM VILOYATI",
    zone_stored: "SW",
    zone_label: "SOUTH-WEST",
    district_stored: null,
    district_label: null
  },
  Urganch: {
    city_label: "Urganch",
    region_stored: "XORAZM_VIL",
    region_label: "XORAZM VILOYATI",
    zone_stored: "SW",
    zone_label: "SOUTH-WEST",
    district_stored: null,
    district_label: null
  }
};

describe("client territory region filter", () => {
  it("matches imported oblast by city codes even when client.region is empty", () => {
    const keys = cityKeysMatchingRegionInHints(xorazmHints, "XORAZM VILOYATI");
    expect(keys).toContain("XR_URGANCH");
    const clause = clientWhereForRegionFilter({ hints: xorazmHints, ref: undefined }, ["XORAZM_VIL"]);
    expect(clause).toBeTruthy();
    const or = (clause as { OR: unknown[] }).OR;
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ city: { in: expect.arrayContaining(["XR_URGANCH"]) } })
      ])
    );
  });

  it("matches XR_ city codes when territory tree is empty", () => {
    const clause = clientWhereForRegionFilter({ hints: {}, ref: undefined }, ["XORAZM VILOYATI"]);
    expect(clause).toBeTruthy();
    const or = (clause as { OR: unknown[] }).OR;
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ city: { startsWith: "XR_", mode: "insensitive" } })
      ])
    );
  });
});

describe("opening-balance Excel region patch", () => {
  it("fills empty card region and zone from Excel oblast", () => {
    expect(zoneForExcelRegion("XORAZM VILOYATI")).toBe("SOUTH-WEST");
    expect(
      excelRegionCardPatch({
        cardRegion: null,
        cardZone: null,
        excelRegion: "XORAZM VILOYATI"
      })
    ).toEqual({
      patch: { region: "XORAZM VILOYATI", zone: "SOUTH-WEST" },
      mismatch: false
    });
  });

  it("does not overwrite an existing card region", () => {
    expect(
      excelRegionCardPatch({
        cardRegion: "TOSHKENT SHAHAR",
        cardZone: null,
        excelRegion: "XORAZM VILOYATI"
      })
    ).toEqual({ patch: null, mismatch: true });
  });
});
