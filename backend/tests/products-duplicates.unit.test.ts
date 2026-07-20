import { describe, expect, it } from "vitest";
import { normalizeProductDupKey } from "../src/modules/products/products.duplicates";

describe("product duplicate keys", () => {
  it("normalizes name/sku for comparison", () => {
    expect(normalizeProductDupKey("  LIVIAL   CLASSIC ")).toBe("livial classic");
    expect(normalizeProductDupKey("ABC-01")).toBe("abc-01");
  });
});
