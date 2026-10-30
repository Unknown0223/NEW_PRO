import { describe, expect, it } from "vitest";
import {
  filterCatalogByAllowedPriceTypes,
  filterPriceTypeOptionsByAllowed,
  resolveAgentAllowedPriceTypes
} from "../src/modules/orders/price-type-restriction";

describe("price-type-restriction", () => {
  const catalog = ["Naxt", "Terminal", "Pereches", "Naxt_B"];

  it("entitlements whitelist wins over broader agent_price_types", () => {
    expect(
      resolveAgentAllowedPriceTypes({
        entitlementsPriceTypes: ["Naxt_B"],
        agentPriceTypes: ["Naxt", "Terminal", "Pereches", "Naxt_B"],
        legacyPriceType: "Naxt"
      })
    ).toEqual(["Naxt_B"]);
  });

  it("falls back to agent_price_types when entitlements empty", () => {
    expect(
      resolveAgentAllowedPriceTypes({
        entitlementsPriceTypes: [],
        agentPriceTypes: ["Terminal", "Naxt_B"],
        legacyPriceType: null
      })
    ).toEqual(["Terminal", "Naxt_B"]);
  });

  it("filters catalog by allow-list (case-insensitive)", () => {
    expect(filterCatalogByAllowedPriceTypes(catalog, ["naxt_b"])).toEqual(["Naxt_B"]);
    expect(filterCatalogByAllowedPriceTypes(catalog, null)).toEqual(catalog);
    expect(filterCatalogByAllowedPriceTypes(catalog, [])).toEqual(catalog);
  });

  it("filters price_type_options for mobile config", () => {
    const opts = catalog.map((id) => ({ id, label: id }));
    expect(filterPriceTypeOptionsByAllowed(opts, ["Naxt_B"]).map((o) => o.id)).toEqual(["Naxt_B"]);
  });
});
