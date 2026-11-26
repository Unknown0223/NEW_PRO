import { describe, expect, it } from "vitest";
import {
  formatOutletClassBandsSummary,
  formatThresholdShort,
  parseOutletClassBandsString,
  serializeOutletClassBands
} from "@/lib/outlet-class-bands";

describe("outlet-class-bands", () => {
  it("parses and serializes A/B/C/D", () => {
    const bands = parseOutletClassBandsString("A:1000000,B:500000,C:100000,D:0");
    expect(bands.map((b) => b.name)).toEqual(["A", "B", "C", "D"]);
    expect(serializeOutletClassBands(bands)).toBe("A:1000000,B:500000,C:100000,D:0");
  });

  it("formats short thresholds", () => {
    expect(formatThresholdShort(1_000_000)).toBe("1 млн");
    expect(formatThresholdShort(500_000)).toBe("500 тыс");
    expect(formatOutletClassBandsSummary("A:1000000,B:500000,C:100000,D:0")).toContain("A≥1 млн");
  });
});
