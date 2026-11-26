import { describe, expect, it } from "vitest";
import {
  formatOutletClassBandsSummary,
  formatOutletClassRowLabel,
  formatThresholdShort,
  parseOutletClassBandsString,
  serializeOutletClassBands
} from "@/lib/outlet-class-bands";

const RAW = "A:1000000,B:500000,C:100000,D:0";

describe("outlet-class-bands", () => {
  it("parses and serializes A/B/C/D", () => {
    const bands = parseOutletClassBandsString(RAW);
    expect(bands.map((b) => b.name)).toEqual(["A", "B", "C", "D"]);
    expect(serializeOutletClassBands(bands)).toBe(RAW);
  });

  it("formats short thresholds", () => {
    expect(formatThresholdShort(1_000_000)).toBe("1 млн");
    expect(formatThresholdShort(500_000)).toBe("500 тыс");
    expect(formatOutletClassBandsSummary(RAW)).toContain("A≥1 млн");
  });

  it("formats SalesDoc-style row labels from bands", () => {
    expect(formatOutletClassRowLabel("A", RAW)).toBe("≥ 1 млн");
    expect(formatOutletClassRowLabel("B", RAW)).toBe("500 тыс – 1 млн");
    expect(formatOutletClassRowLabel("C", RAW)).toBe("100 тыс – 500 тыс");
    expect(formatOutletClassRowLabel("D", RAW)).toBe("< 100 тыс");
  });
});
