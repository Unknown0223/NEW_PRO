import { describe, expect, it } from "vitest";
import {
  collectAllTrueCategoryIds,
  parseEntitledProductIds,
  parseProductEntitlementRules
} from "../src/modules/linkage/linkage.shared";

const mixedEntitlements = {
  product_rules: [
    { category_id: 10, all: true },
    { category_id: 20, all: false, product_ids: [201, 202] }
  ]
};

describe("parseProductEntitlementRules", () => {
  it("keeps all:true categories even when other rules have product_ids", () => {
    const parsed = parseProductEntitlementRules(mixedEntitlements);
    expect(parsed.restricted).toBe(true);
    expect(parsed.allCategoryIds).toEqual([10]);
    expect(parsed.partialCategoryIds).toEqual([20]);
    expect(parsed.productIds.sort((a, b) => a - b)).toEqual([201, 202]);
  });

  it("marks all:true-only rules as restricted with no explicit ids", () => {
    const parsed = parseProductEntitlementRules({
      product_rules: [
        { category_id: 10, all: true },
        { category_id: 30, all: true }
      ]
    });
    expect(parsed.restricted).toBe(true);
    expect(parsed.productIds).toEqual([]);
    expect(parsed.allCategoryIds.sort((a, b) => a - b)).toEqual([10, 30]);
  });

  it("returns unrestricted when product_rules are empty", () => {
    expect(parseProductEntitlementRules({ product_rules: [] })).toEqual({
      productIds: [],
      allCategoryIds: [],
      partialCategoryIds: [],
      restricted: false
    });
  });
});

describe("parseEntitledProductIds", () => {
  it("still returns only explicit product ids (compat)", () => {
    const parsed = parseEntitledProductIds(mixedEntitlements);
    expect(parsed.restricted).toBe(true);
    expect(parsed.ids.sort((a, b) => a - b)).toEqual([201, 202]);
  });
});

describe("collectAllTrueCategoryIds", () => {
  const tree = [
    { id: 10, parent_id: null },
    { id: 11, parent_id: 10 },
    { id: 20, parent_id: null },
    { id: 30, parent_id: null }
  ];

  it("expands all:true categories even when another category is partial", () => {
    expect(collectAllTrueCategoryIds([10], [20], tree)).toEqual([10, 11]);
  });

  it("does not pull products from a partially selected child of an all:true parent", () => {
    expect(collectAllTrueCategoryIds([10], [11], tree)).toEqual([10]);
  });

  it("includes every fully selected category", () => {
    expect(collectAllTrueCategoryIds([10, 30], [], tree)).toEqual([10, 11, 30]);
  });
});
