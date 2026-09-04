import { describe, expect, it } from "vitest";
import {
  buildTerritoriesFromPartLists,
  effectiveBranchCodes,
  effectiveCashDeskIds,
  effectiveTerritories,
  effectiveWarehouseIds,
  normalizePositiveIntIds,
  normalizeTerritoryList,
  resolveBranchCodesPatch,
  resolveCashDeskIdsPatch,
  resolveTerritoriesPatch,
  resolveWarehouseIdsPatch
} from "../src/modules/work-slots/work-slots.multi-bindings";

describe("work-slots.multi-bindings", () => {
  it("normalizePositiveIntIds dedupes and drops invalid", () => {
    expect(normalizePositiveIntIds([1, 1, 2, 0, -3, "4", null])).toEqual([1, 2, 4]);
  });

  it("normalizeTerritoryList trims and dedupes", () => {
    expect(normalizeTerritoryList([" A ", "A", "", "B"])).toEqual(["A", "B"]);
  });

  it("resolveWarehouseIdsPatch replaces with array", () => {
    expect(
      resolveWarehouseIdsPatch({
        existingIds: [1],
        existingPrimary: 1,
        warehouse_ids: [3, 2]
      })
    ).toEqual({ warehouse_ids: [3, 2], warehouse_id: 3 });
  });

  it("resolveWarehouseIdsPatch promotes singular to front", () => {
    expect(
      resolveWarehouseIdsPatch({
        existingIds: [1, 2],
        existingPrimary: 1,
        warehouse_id: 2
      })
    ).toEqual({ warehouse_ids: [2, 1], warehouse_id: 2 });
  });

  it("resolveCashDeskIdsPatch clears on null singular", () => {
    expect(
      resolveCashDeskIdsPatch({
        existingIds: [5],
        existingPrimary: 5,
        cash_desk_id: null
      })
    ).toEqual({ cash_desk_ids: [], cash_desk_id: null });
  });

  it("resolveTerritoriesPatch keeps primary first", () => {
    expect(
      resolveTerritoriesPatch({
        existingList: ["A / B"],
        existingPrimary: "A / B",
        territories: ["X / Y", "A / B"]
      })
    ).toEqual({ territories: ["X / Y", "A / B"], territory: "X / Y" });
  });

  it("resolveBranchCodesPatch replaces with array", () => {
    expect(
      resolveBranchCodesPatch({
        existingCodes: ["A"],
        existingPrimary: "A",
        branch_codes: ["B", "C"]
      })
    ).toEqual({ branch_codes: ["B", "C"], branch_code: "B" });
  });

  it("resolveBranchCodesPatch promotes singular to front", () => {
    expect(
      resolveBranchCodesPatch({
        existingCodes: ["A", "B"],
        existingPrimary: "A",
        branch_code: "B"
      })
    ).toEqual({ branch_codes: ["B", "A"], branch_code: "B" });
  });

  it("effective* falls back to singular", () => {
    expect(effectiveWarehouseIds({ warehouse_id: 9 })).toEqual([9]);
    expect(effectiveCashDeskIds({ cash_desk_ids: [1, 2], cash_desk_id: 9 })).toEqual([1, 2]);
    expect(effectiveTerritories({ territory: " Z " })).toEqual(["Z"]);
    expect(effectiveBranchCodes({ branch_code: " Farg'ona " })).toEqual(["Farg'ona"]);
  });

  it("resolveTerritoriesPatch replacePrimary swaps first only", () => {
    expect(
      resolveTerritoriesPatch({
        existingList: ["A / B / C", "X / Y"],
        existingPrimary: "A / B / C",
        territory: "A / B / D",
        replacePrimary: true
      })
    ).toEqual({ territories: ["A / B / D", "X / Y"], territory: "A / B / D" });
  });

  it("buildTerritoriesFromPartLists zips cities with parents", () => {
    expect(
      buildTerritoriesFromPartLists({
        zones: ["FV"],
        oblasts: ["ANDIJON"],
        cities: ["ASAKA", "BALIQCHI"]
      })
    ).toEqual(["FV / ANDIJON / ASAKA", "FV / ANDIJON / BALIQCHI"]);
  });

  it("buildTerritoriesFromPartLists uses zones only", () => {
    expect(buildTerritoriesFromPartLists({ zones: ["FV", "SW"] })).toEqual(["FV", "SW"]);
  });
});
