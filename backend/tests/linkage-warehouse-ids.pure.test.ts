import { describe, expect, it } from "vitest";
import { mergeWarehouseIdSources } from "../src/modules/linkage/linkage.warehouse-ids";

describe("mergeWarehouseIdSources", () => {
  it("merges link, user primary, slot primary and slot arrays", () => {
    expect(
      mergeWarehouseIdSources({
        linkIds: [1, 2],
        userPrimary: 2,
        slotPrimary: 3,
        slotIds: [3, 4]
      }).sort((a, b) => a - b)
    ).toEqual([1, 2, 3, 4]);
  });

  it("drops invalid ids", () => {
    expect(
      mergeWarehouseIdSources({
        linkIds: [0, -1, Number.NaN],
        userPrimary: null,
        slotPrimary: undefined,
        slotIds: []
      })
    ).toEqual([]);
  });

  it("uses slot warehouses when links are empty (dastavchik joyga bog‘langan)", () => {
    expect(
      mergeWarehouseIdSources({
        linkIds: [],
        userPrimary: null,
        slotPrimary: 10,
        slotIds: [11]
      }).sort((a, b) => a - b)
    ).toEqual([10, 11]);
  });
});
