import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, groupCount } = vi.hoisted(() => ({
  findMany: vi.fn(),
  groupCount: vi.fn()
}));

vi.mock("../src/config/database", () => ({
  prisma: {
    interchangeableGroupProduct: {
      findMany
    },
    interchangeableProductGroup: {
      count: groupCount
    }
  }
}));

import { assertReturnProductsInterchangeableStrict } from "../src/modules/products/product-catalog.service";

describe("assertReturnProductsInterchangeableStrict", () => {
  beforeEach(() => {
    findMany.mockReset();
    groupCount.mockReset();
    groupCount.mockResolvedValue(1);
  });

  it("skips check when tenant has no interchangeable groups", async () => {
    groupCount.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
    await expect(assertReturnProductsInterchangeableStrict(1, [99], "retail")).resolves.toBeUndefined();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("resolves when product is in a group with no price_type constraints", async () => {
    findMany.mockResolvedValue([{ product_id: 10, group: { price_type_links: [] } }]);
    await expect(assertReturnProductsInterchangeableStrict(1, [10], "retail")).resolves.toBeUndefined();
  });

  it("resolves when price_type is listed on the group", async () => {
    findMany.mockResolvedValue([
      { product_id: 10, group: { price_type_links: [{ price_type: "wholesale" }] } }
    ]);
    await expect(assertReturnProductsInterchangeableStrict(1, [10], "wholesale")).resolves.toBeUndefined();
  });

  it("rejects when group has price_types but none match", async () => {
    findMany.mockResolvedValue([
      { product_id: 10, group: { price_type_links: [{ price_type: "wholesale" }] } }
    ]);
    await expect(assertReturnProductsInterchangeableStrict(1, [10], "retail")).rejects.toThrow(
      "RETURN_NOT_INTERCHANGEABLE"
    );
  });

  it("matches price_type case-insensitively and ignores separators", async () => {
    findMany.mockResolvedValue([
      { product_id: 10, group: { price_type_links: [{ price_type: "NAQD_PUL" }] } }
    ]);
    await expect(assertReturnProductsInterchangeableStrict(1, [10], "naqd pul")).resolves.toBeUndefined();
  });

  it("rejects when product has no active group rows", async () => {
    findMany.mockResolvedValue([]);
    await expect(assertReturnProductsInterchangeableStrict(1, [99], "retail")).rejects.toThrow(
      "RETURN_NOT_INTERCHANGEABLE"
    );
  });

  it("succeeds if any linked group allows the price_type (empty links)", async () => {
    findMany.mockResolvedValue([
      { product_id: 10, group: { price_type_links: [{ price_type: "wholesale" }] } },
      { product_id: 10, group: { price_type_links: [] } }
    ]);
    await expect(assertReturnProductsInterchangeableStrict(1, [10], "retail")).resolves.toBeUndefined();
  });

  it("defaults empty price_type to retail", async () => {
    findMany.mockResolvedValue([
      { product_id: 10, group: { price_type_links: [{ price_type: "retail" }] } }
    ]);
    await expect(assertReturnProductsInterchangeableStrict(1, [10], "   ")).resolves.toBeUndefined();
  });
});
