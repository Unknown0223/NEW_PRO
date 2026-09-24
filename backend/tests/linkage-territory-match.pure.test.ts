import { describe, expect, it } from "vitest";
import {
  collectCoverageFromTerritoryString,
  staffTerritoriesMatchAddress,
  staffTerritoryStringMatchesAddress,
  territoryTokensMatch
} from "../src/modules/linkage/linkage.territory-match.pure";

describe("territoryTokensMatch (kod ↔ nom)", () => {
  it("matches XR_XIVA with XIVA", () => {
    expect(territoryTokensMatch("XR_XIVA", "XIVA")).toBe(true);
    expect(territoryTokensMatch("XIVA", "XR_XIVA")).toBe(true);
  });

  it("matches region variants", () => {
    expect(territoryTokensMatch("XORAZM VILOYATI", "XORAZM")).toBe(true);
  });

  it("does not match different oblasts via shared VILOYATI suffix", () => {
    expect(territoryTokensMatch("XORAZM VILOYATI", "TASHKENT VILOYATI")).toBe(false);
    expect(territoryTokensMatch("BUXORO VILOYATI", "XORAZM VILOYATI")).toBe(false);
  });
});

describe("staffTerritoryStringMatchesAddress", () => {
  const xiv = {
    zone: "SOUTH-WEST",
    region: "XORAZM VILOYATI",
    city: "XIVA"
  };

  it("matches full path agent to client city", () => {
    expect(
      staffTerritoryStringMatchesAddress("SOUTH-WEST / XORAZM VILOYATI / XIVA", xiv)
    ).toBe(true);
  });

  it("matches client city CODE to slot city NAME", () => {
    expect(
      staffTerritoryStringMatchesAddress("SOUTH-WEST / XORAZM VILOYATI / XIVA", {
        ...xiv,
        city: "XR_XIVA"
      })
    ).toBe(true);
  });

  it("matches oblast-level agent to city in that oblast", () => {
    expect(staffTerritoryStringMatchesAddress("SOUTH-WEST / XORAZM VILOYATI", xiv)).toBe(true);
  });

  it("rejects other oblast", () => {
    expect(
      staffTerritoryStringMatchesAddress("SOUTH-WEST / TASHKENT VILOYATI / XIVA", xiv)
    ).toBe(false);
    expect(staffTerritoryStringMatchesAddress("SOUTH-WEST / BUXORO VILOYATI", xiv)).toBe(false);
  });

  it("rejects other city in same oblast", () => {
    expect(
      staffTerritoryStringMatchesAddress("SOUTH-WEST / XORAZM VILOYATI / URGANCH", xiv)
    ).toBe(false);
  });

  it("zone-only agent covers all clients in that zone", () => {
    expect(staffTerritoryStringMatchesAddress("SOUTH-WEST", { zone: "SOUTH-WEST" })).toBe(true);
    expect(
      staffTerritoryStringMatchesAddress("SOUTH-WEST", {
        zone: "SOUTH-WEST",
        region: "XORAZM VILOYATI",
        city: "XIVA"
      })
    ).toBe(true);
    expect(staffTerritoryStringMatchesAddress("SOUTH-WEST", { zone: "NORTH" })).toBe(false);
  });

  it("empty address or territory → false", () => {
    expect(staffTerritoryStringMatchesAddress("", xiv)).toBe(false);
    expect(staffTerritoryStringMatchesAddress("SOUTH-WEST / XORAZM VILOYATI / XIVA", {})).toBe(
      false
    );
  });
});

describe("staffTerritoriesMatchAddress (work-slot multi-city)", () => {
  const xiv = {
    zone: "SOUTH-WEST",
    region: "XORAZM VILOYATI",
    city: "XIVA"
  };

  it("matches when XIVA is one of many full paths (PKXR-style)", () => {
    const blobs = [
      "SOUTH-WEST / XORAZM VILOYATI / BERUNIY",
      "SOUTH-WEST / XORAZM VILOYATI / URGANCH",
      "SOUTH-WEST / XORAZM VILOYATI / XIVA",
      "SOUTH-WEST / XORAZM VILOYATI / XONQA"
    ];
    expect(staffTerritoriesMatchAddress(blobs, xiv)).toBe(true);
    expect(staffTerritoriesMatchAddress(blobs, { ...xiv, city: "XR_XIVA" })).toBe(true);
    expect(staffTerritoriesMatchAddress(blobs, { ...xiv, city: "GURLAN" })).toBe(false);
  });

  it("matches bare city list like display overflow (BERUNIY, XIVA, ...)", () => {
    expect(
      staffTerritoriesMatchAddress(
        ["BERUNIY", "URGANCH", "URGANCH TUMANI", "XAZORASP", "XIVA", "XONQA"],
        xiv
      )
    ).toBe(true);
  });

  it("matches comma-joined cities under one zone/oblast path", () => {
    expect(
      staffTerritoriesMatchAddress(
        ["SOUTH-WEST / XORAZM VILOYATI / BERUNIY, URGANCH, XIVA, XONQA"],
        xiv
      )
    ).toBe(true);
  });

  it("collectCoverage extracts cities from multi path", () => {
    const c = collectCoverageFromTerritoryString(
      "SOUTH-WEST / XORAZM VILOYATI / BERUNIY, XIVA"
    );
    expect(c.zones).toEqual(["SOUTH-WEST"]);
    expect(c.oblasts).toEqual(["XORAZM VILOYATI"]);
    expect(c.cities).toEqual(["BERUNIY", "XIVA"]);
  });
});
