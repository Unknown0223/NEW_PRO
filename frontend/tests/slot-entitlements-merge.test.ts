import { describe, expect, it } from "vitest";
import { mergeSlotEntitlementsForEditor, parseSlotEntitlements } from "@/lib/slot-entitlements-merge";

describe("mergeSlotEntitlementsForEditor", () => {
  it("returns empty when no slots", () => {
    expect(mergeSlotEntitlementsForEditor([])).toEqual({
      merged: { price_types: [], product_rules: [] },
      mixed: false
    });
  });

  it("keeps identical entitlements after merge", () => {
    const one = {
      price_types: ["Naxt"],
      product_rules: [{ category_id: 3, all: true }]
    };
    const r = mergeSlotEntitlementsForEditor([one, { ...one, product_rules: [...one.product_rules] }]);
    expect(r.mixed).toBe(false);
    expect(r.merged.price_types).toEqual(["Naxt"]);
    expect(r.merged.product_rules).toEqual([{ category_id: 3, all: true }]);
  });

  it("unions mixed slots so saved ticks stay visible", () => {
    const r = mergeSlotEntitlementsForEditor([
      { price_types: ["Naxt"], product_rules: [{ category_id: 1, all: true }] },
      {
        price_types: ["Terminal"],
        product_rules: [{ category_id: 2, all: false, product_ids: [9, 8] }]
      }
    ]);
    expect(r.mixed).toBe(true);
    expect(r.merged.price_types.sort()).toEqual(["Naxt", "Terminal"]);
    expect(r.merged.product_rules).toEqual([
      { category_id: 1, all: true },
      { category_id: 2, all: false, product_ids: [8, 9] }
    ]);
  });
});

describe("parseSlotEntitlements", () => {
  it("reads price_types and product_rules", () => {
    expect(
      parseSlotEntitlements({
        price_types: ["Naxt", 1, ""],
        product_rules: [{ category_id: 4, all: false, product_ids: [2] }],
        mobile_config: {}
      })
    ).toEqual({
      price_types: ["Naxt"],
      product_rules: [{ category_id: 4, all: false, product_ids: [2] }]
    });
  });

  it("coerces string category_id and product_ids", () => {
    expect(
      parseSlotEntitlements({
        price_types: ["Terminal"],
        product_rules: [{ category_id: "7", all: true, product_ids: ["12"] }]
      })
    ).toEqual({
      price_types: ["Terminal"],
      product_rules: [{ category_id: 7, all: true }]
    });
  });
});
