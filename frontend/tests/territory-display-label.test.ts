import { describe, expect, it } from "vitest";
import {
  cityStoredCodeToDisplayLabel,
  looksLikeTerritoryStoredCode
} from "@/lib/city-territory-hint";
import { territoryLeafNameOnly } from "@/components/access/access-user-detail/access-user-detail.types";

describe("cityStoredCodeToDisplayLabel", () => {
  it("strips AD_ / AD- / AD  prefixes", () => {
    expect(cityStoredCodeToDisplayLabel("AD_ASAKA")).toBe("Asaka");
    expect(cityStoredCodeToDisplayLabel("AD-ASAKA")).toBe("Asaka");
    expect(cityStoredCodeToDisplayLabel("AD ASAKA")).toBe("Asaka");
    expect(cityStoredCodeToDisplayLabel("AD_JALAQUDUQ")).toBe("Jalaquduq");
  });

  it("keeps real human labels", () => {
    expect(cityStoredCodeToDisplayLabel("AD_ASAKA", "Asaka")).toBe("Asaka");
    expect(cityStoredCodeToDisplayLabel("AD_ASAKA", "Андижан")).toBe("Андижан");
  });

  it("detects coded labels", () => {
    expect(looksLikeTerritoryStoredCode("AD ASAKA")).toBe(true);
    expect(looksLikeTerritoryStoredCode("AD_ASAKA")).toBe(true);
    expect(looksLikeTerritoryStoredCode("Asaka")).toBe(false);
    expect(looksLikeTerritoryStoredCode("Андижан")).toBe(false);
  });
});

describe("territoryLeafNameOnly", () => {
  it("shows name without code prefix", () => {
    expect(
      territoryLeafNameOnly({ id: 1, name: "AD ASAKA", code: "AD_ASAKA", is_active: true })
    ).toBe("Asaka");
    expect(
      territoryLeafNameOnly({ id: 2, name: "Asaka", code: "AD_ASAKA", is_active: true })
    ).toBe("Asaka");
  });
});
