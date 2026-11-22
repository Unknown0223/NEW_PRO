import { describe, expect, it } from "vitest";
import {
  isUnsetOrderPriceType,
  resolveEffectiveOrderPriceType
} from "../src/modules/orders/order-price-type.resolve.pure";

describe("order-price-type.resolve", () => {
  it("treats empty and placeholder keys as unset", () => {
    expect(isUnsetOrderPriceType(null)).toBe(true);
    expect(isUnsetOrderPriceType("")).toBe(true);
    expect(isUnsetOrderPriceType("  ")).toBe(true);
    expect(isUnsetOrderPriceType("default")).toBe(true);
    expect(isUnsetOrderPriceType("DEFAULT")).toBe(true);
    expect(isUnsetOrderPriceType("auto")).toBe(true);
    expect(isUnsetOrderPriceType("retail")).toBe(false);
    expect(isUnsetOrderPriceType("1")).toBe(false);
    expect(isUnsetOrderPriceType("Naxt_B")).toBe(false);
  });

  it("keeps a real requested price type", () => {
    expect(
      resolveEffectiveOrderPriceType({
        requested: "wholesale",
        clientPriceType: "retail",
        catalogPriceTypes: ["1", "2"]
      })
    ).toBe("wholesale");
  });

  it("maps mobile placeholder default to client then catalog then retail", () => {
    expect(
      resolveEffectiveOrderPriceType({
        requested: "default",
        clientPriceType: "wholesale",
        catalogPriceTypes: ["retail", "wholesale"]
      })
    ).toBe("wholesale");

    expect(
      resolveEffectiveOrderPriceType({
        requested: "default",
        clientPriceType: null,
        catalogPriceTypes: ["1", "2", "Naxt_B"]
      })
    ).toBe("1");

    expect(
      resolveEffectiveOrderPriceType({
        requested: "default",
        clientPriceType: "",
        catalogPriceTypes: []
      })
    ).toBe("retail");
  });

  it("ignores placeholder client/catalog entries", () => {
    expect(
      resolveEffectiveOrderPriceType({
        requested: null,
        clientPriceType: "default",
        catalogPriceTypes: ["default", "retail"]
      })
    ).toBe("retail");
  });
});
