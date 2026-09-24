import { describe, expect, it } from "vitest";
import {
  applySelectToDraft,
  buildStaffScope,
  cityMatchesRegion,
  entriesToOpts,
  filterOptionsForField,
  isLikelyRegionStored,
  parseUserTerritoryParts,
  type TenantRefs
} from "./salec-refs.js";
import type { ClientDraft } from "./types.js";

function sampleRefs(): TenantRefs {
  return {
    sales_channel: [{ value: "HORECA", label: "HoReCa" }],
    category: [{ value: "A", label: "A" }, { value: "B", label: "B" }],
    client_type: [{ value: "SHOP", label: "Do‘kon" }],
    client_format: [{ value: "MINI", label: "Mini" }],
    region: [
      { value: "ANDIJON_VIL", label: "ANDIJON VILOYATI" },
      { value: "FARGONA_VIL", label: "FARGONA VILOYATI" }
    ],
    city: [
      {
        value: "AD_ANDIJON",
        label: "Andijon",
        region: "ANDIJON_VIL",
        region_label: "ANDIJON VILOYATI",
        zone: "FV"
      },
      {
        value: "AD_ASAKA",
        label: "Asaka",
        region: "ANDIJON_VIL",
        region_label: "ANDIJON VILOYATI",
        zone: "FV"
      },
      {
        value: "FR_FARGONA",
        label: "Farg‘ona",
        region: "FARGONA_VIL",
        region_label: "FARGONA VILOYATI",
        zone: "FV"
      }
    ],
    cityHints: {
      AD_ANDIJON: {
        city_label: "Andijon",
        region: "ANDIJON_VIL",
        region_label: "ANDIJON VILOYATI",
        zone: "FV",
        zone_label: "FV"
      },
      AD_ASAKA: {
        city_label: "Asaka",
        region: "ANDIJON_VIL",
        region_label: "ANDIJON VILOYATI",
        zone: "FV",
        zone_label: "FV"
      },
      FR_FARGONA: {
        city_label: "Farg‘ona",
        region: "FARGONA_VIL",
        region_label: "FARGONA VILOYATI",
        zone: "FV",
        zone_label: "FV"
      }
    }
  };
}

describe("salec catalog + staff hudud", () => {
  it("parses slot territory zona / viloyat / shahar", () => {
    expect(parseUserTerritoryParts("FV / ANDIJON VILOYATI / Andijon")).toEqual({
      zone: "FV",
      oblast: "ANDIJON VILOYATI",
      city: "Andijon"
    });
  });

  it("keeps settings entries and skips inactive", () => {
    const opts = entriesToOpts(
      [
        { code: "A", name: "Kategoriya A", active: true },
        { code: "X", name: "Yopiq", active: false }
      ],
      ["legacy"]
    );
    expect(opts.map((o) => o.value)).toEqual(["A"]);
  });

  it("filters cities by selected region like the panel cascade", () => {
    const refs = sampleRefs();
    const opts = filterOptionsForField(refs, "city", { region: "ANDIJON VILOYATI" }, null);
    expect(opts.map((o) => o.value).sort()).toEqual(["AD_ANDIJON", "AD_ASAKA"]);
  });

  it("scopes agent to work-slot hudud (viloyat)", () => {
    const refs = sampleRefs();
    const scope = buildStaffScope(["FV / ANDIJON VILOYATI"], [], refs);
    expect(scope.scoped).toBe(true);
    const cities = filterOptionsForField(refs, "city", {}, scope);
    expect(cities.map((c) => c.value).sort()).toEqual(["AD_ANDIJON", "AD_ASAKA"]);
    const regions = filterOptionsForField(refs, "region", {}, scope);
    expect(regions.some((r) => r.value === "ANDIJON_VIL" || r.label === "ANDIJON VILOYATI")).toBe(true);
    expect(regions.some((r) => r.value === "FARGONA_VIL")).toBe(false);
  });

  it("treats a single viloyat string as region, not zone", () => {
    const refs = sampleRefs();
    const scope = buildStaffScope(["ANDIJON VILOYATI"], [], refs);
    const cities = filterOptionsForField(refs, "city", {}, scope);
    expect(cities.map((c) => c.value).sort()).toEqual(["AD_ANDIJON", "AD_ASAKA"]);
  });

  it("does not put viloyat codes into the city list", () => {
    expect(isLikelyRegionStored("ANDIJON_VIL")).toBe(true);
    expect(isLikelyRegionStored("AD_ANDIJON")).toBe(false);
  });

  it("clears city when hudud changes", () => {
    const draft: Partial<ClientDraft> = {
      region: "ANDIJON_VIL",
      region_label: "ANDIJON VILOYATI",
      city: "AD_ANDIJON",
      city_label: "Andijon"
    };
    const cleared = applySelectToDraft(draft, "region", {
      value: "FARGONA_VIL",
      label: "FARGONA VILOYATI"
    });
    expect(cleared).toBe(true);
    expect(draft.city).toBe("");
    expect(draft.region).toBe("FARGONA_VIL");
  });

  it("fills region from city option", () => {
    const draft: Partial<ClientDraft> = {};
    applySelectToDraft(draft, "city", {
      value: "AD_ASAKA",
      label: "Asaka",
      region: "ANDIJON_VIL",
      region_label: "ANDIJON VILOYATI",
      zone: "FV"
    });
    expect(draft.region).toBe("ANDIJON_VIL");
    expect(draft.region_label).toBe("ANDIJON VILOYATI");
    expect(draft.zone).toBe("FV");
  });

  it("matches city to region by stored code or label", () => {
    expect(
      cityMatchesRegion(
        { value: "AD_ANDIJON", label: "Andijon", region: "ANDIJON_VIL", region_label: "ANDIJON VILOYATI" },
        "ANDIJON VILOYATI"
      )
    ).toBe(true);
  });
});
