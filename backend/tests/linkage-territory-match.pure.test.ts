import { describe, expect, it } from "vitest";
import {
  cityMatchNeedles,
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

  it("matches BOG'OT with BOGOT and XR_BOGOT (apostrof)", () => {
    expect(territoryTokensMatch("BOG'OT", "BOGOT")).toBe(true);
    expect(territoryTokensMatch("BOG'OT", "XR_BOGOT")).toBe(true);
    expect(territoryTokensMatch("XR_BOGOT", "BOG'OT")).toBe(true);
    expect(territoryTokensMatch("QO'SHKO'PIR", "XR_QOSHKOPIR")).toBe(true);
    expect(territoryTokensMatch("TO'RTKO'L", "XR_TORTKOL")).toBe(true);
    expect(territoryTokensMatch("KATTAQO'RG'ON", "SM_KATTAQORGON")).toBe(true);
    expect(territoryTokensMatch("UCHQORG`ON", "NM_UCHQORGON")).toBe(true);
  });

  it("does not treat SHAXAR alone as a city match token", () => {
    expect(territoryTokensMatch("QQ_SHAXAR", "BESHARIK")).toBe(false);
    expect(territoryTokensMatch("BUXORO SHAXAR", "BUXORO TUMANI")).toBe(false);
  });

  it("expands FR_SHAHAR / AD_TUMANI via region", () => {
    expect(cityMatchNeedles("FR_SHAHAR", "FARGONA VILOYATI")).toEqual(
      expect.arrayContaining(["FR_SHAHAR", "FARGONA SHAHAR", "FARGONA SHAXAR"])
    );
    expect(cityMatchNeedles("AD_TUMANI", "ANDIJON VILOYATI")).toEqual(
      expect.arrayContaining(["AD_TUMANI", "ANDIJON TUMANI"])
    );
    expect(cityMatchNeedles("BX_SHAXAR", "BUXORO VILOYATI")).toEqual(
      expect.arrayContaining(["BX_SHAXAR", "BUXORO SHAXAR", "BUXORO SHAHAR"])
    );
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

  it("matches client city CODE XR_BOGOT to slot path with BOG'OT", () => {
    const blobs = [
      "SOUTH-WEST / XORAZM VILOYATI / BERUNIY",
      "SOUTH-WEST / XORAZM VILOYATI / BO'STON",
      "SOUTH-WEST / XORAZM VILOYATI / BOG'OT",
      "SOUTH-WEST / XORAZM VILOYATI / GURLAN"
    ];
    const addr = { zone: "SOUTH-WEST", region: "XORAZM VILOYATI", city: "XR_BOGOT" };
    expect(staffTerritoriesMatchAddress(blobs, addr)).toBe(true);
    expect(staffTerritoriesMatchAddress(blobs, { ...addr, city: "BOGOT" })).toBe(true);
    expect(staffTerritoriesMatchAddress(["BOG'OT", "BERUNIY", "XIVA"], addr)).toBe(true);
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

  it("matches Andijon agent when client zone is FV but slot zone is Andijon", () => {
    expect(
      staffTerritoriesMatchAddress(["Andijon / ANDIJON VILOYATI / ASAKA"], {
        zone: "FV",
        region: "ANDIJON VILOYATI",
        city: "AD_ASAKA"
      })
    ).toBe(true);
  });

  it("matches FR_SHAHAR / AD_TUMANI / BX_SHAXAR to display city names", () => {
    expect(
      staffTerritoriesMatchAddress(["FV / FARGONA VILOYATI / FARGONA SHAHAR"], {
        zone: "FV",
        region: "FARGONA VILOYATI",
        city: "FR_SHAHAR"
      })
    ).toBe(true);
    expect(
      staffTerritoriesMatchAddress(["FV / ANDIJON VILOYATI / ANDIJON TUMANI"], {
        zone: "FV",
        region: "ANDIJON VILOYATI",
        city: "AD_TUMANI"
      })
    ).toBe(true);
    expect(
      staffTerritoriesMatchAddress(["SOUTH-WEST / BUXORO VILOYATI / BUXORO SHAXAR"], {
        zone: "SOUTH-WEST",
        region: "BUXORO VILOYATI",
        city: "BX_SHAXAR"
      })
    ).toBe(true);
  });

  it("does not match QQ_SHAXAR to a different Qoqon city via shared SHAXAR", () => {
    expect(
      staffTerritoriesMatchAddress(["FV / QOQON SHAXAR / BESHARIK"], {
        zone: "FV",
        region: "QOQON SHAXAR",
        city: "QQ_SHAXAR"
      })
    ).toBe(false);
  });

  it("does not match BX_SHAXAR to BUXORO TUMANI", () => {
    expect(
      staffTerritoriesMatchAddress(["SOUTH-WEST / BUXORO VILOYATI / BUXORO TUMANI"], {
        zone: "SOUTH-WEST",
        region: "BUXORO VILOYATI",
        city: "BX_SHAXAR"
      })
    ).toBe(false);
  });
});
