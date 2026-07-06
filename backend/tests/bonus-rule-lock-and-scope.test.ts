import { describe, expect, it } from "vitest";
import { validateAutoBonusProductScope } from "../src/modules/bonus-rules/bonus-rules.validate";

describe("validateAutoBonusProductScope", () => {
  it("scope_restrict_category: kategoriya tanlangan bo‘lsa — OK", () => {
    expect(() =>
      validateAutoBonusProductScope("qty", false, [], [1, 2], false, true)
    ).not.toThrow();
  });

  it("scope_restrict_assortment: mahsulot tanlanmagan — xato", () => {
    expect(() =>
      validateAutoBonusProductScope("qty", false, [], [], true, false)
    ).toThrow("PRODUCT_SCOPE_REQUIRED");
  });

  it("scope_restrict_category: kategoriya va SKU bo‘sh — xato", () => {
    expect(() =>
      validateAutoBonusProductScope("qty", false, [], [], false, true)
    ).toThrow("PRODUCT_SCOPE_REQUIRED");
  });
});
