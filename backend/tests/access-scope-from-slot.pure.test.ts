import { describe, expect, it } from "vitest";
import {
  mergeBranchCodesForScope,
  mergeGeoStaffIds,
  mergeTerritoryTermsForScope,
  mergeWarehouseIdsForScope
} from "../src/modules/access/access-scope-from-slot";
import { resolveStaffVisibilityByExplicitAndGeo } from "../src/modules/access/access-staff-scope";

describe("access-scope-from-slot", () => {
  it("merges branch codes from links and slot", () => {
    expect(
      mergeBranchCodesForScope(["Andijon"], {
        branch_code: "Buxoro",
        branch_codes: ["Farg'ona", " Andijon "]
      }).sort()
    ).toEqual(["Andijon", "Buxoro", "Farg'ona"].sort());
  });

  it("extracts territory path segments", () => {
    const terms = mergeTerritoryTermsForScope(null, {
      territory: "Zona / ANDIJON VILOYATI / ANDIJON",
      territories: ["F / BUXORO / CITY"]
    });
    expect(terms).toContain("ANDIJON");
    expect(terms).toContain("BUXORO");
    // Zona (birinchi segment) geo qidiruvga kirmaydi
    expect(terms.some((t) => t.trim().toLowerCase() === "zona")).toBe(false);
    expect(terms.some((t) => t.trim().toLowerCase() === "f")).toBe(false);
  });

  it("merges warehouse ids", () => {
    expect(
      mergeWarehouseIdsForScope([1, 2], { warehouse_id: 2, warehouse_ids: [3, 1] }).sort()
    ).toEqual([1, 2, 3]);
  });

  it("merges geo staff ids (union within geo only)", () => {
    expect(mergeGeoStaffIds([1, 2], [2, 3], [4])).toEqual([1, 2, 3, 4]);
  });
});

describe("resolveStaffVisibilityByExplicitAndGeo — Dostup qoidalari", () => {
  it("hech narsa — bo‘sh", () => {
    expect(
      resolveStaffVisibilityByExplicitAndGeo({
        explicitStaffIds: [],
        geoStaffIds: [9],
        hasGeoBinding: false
      })
    ).toEqual([]);
  });

  it("faqat territoriya/filial — geo dagi barcha hodimlar", () => {
    expect(
      resolveStaffVisibilityByExplicitAndGeo({
        explicitStaffIds: [],
        geoStaffIds: [20, 21, 22],
        hasGeoBinding: true
      })
    ).toEqual([20, 21, 22]);
  });

  it("faqat belgilangan hodimlar — shu hodimlar", () => {
    expect(
      resolveStaffVisibilityByExplicitAndGeo({
        explicitStaffIds: [10, 11],
        geoStaffIds: [99],
        hasGeoBinding: false
      })
    ).toEqual([10, 11]);
  });

  it("territoriya + hodim — faqat kesishma", () => {
    expect(
      resolveStaffVisibilityByExplicitAndGeo({
        explicitStaffIds: [10, 11, 12],
        geoStaffIds: [11, 99],
        hasGeoBinding: true
      })
    ).toEqual([11]);
  });

  it("territoriya + begona hodim — hech kim (geo tashqarida)", () => {
    expect(
      resolveStaffVisibilityByExplicitAndGeo({
        explicitStaffIds: [10],
        geoStaffIds: [20, 21],
        hasGeoBinding: true
      })
    ).toEqual([]);
  });

  it("territoriya + hodim, geo resolve bo‘sh — explicit saqlanadi", () => {
    expect(
      resolveStaffVisibilityByExplicitAndGeo({
        explicitStaffIds: [10, 11],
        geoStaffIds: [],
        hasGeoBinding: true
      })
    ).toEqual([10, 11]);
  });
});
