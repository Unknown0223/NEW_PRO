import { describe, expect, it } from "vitest";
import { Aggregator } from "../src/core/Aggregator.js";

describe("Aggregator", () => {
  const aggregator = new Aggregator();
  const values = [10, 20, 30, 20];

  it("SUM", () => {
    expect(aggregator.aggregate(values, "SUM")).toBe(80);
  });

  it("COUNT", () => {
    expect(aggregator.aggregate(values, "COUNT")).toBe(4);
  });

  it("AVG", () => {
    expect(aggregator.aggregate(values, "AVG")).toBe(20);
  });

  it("MIN", () => {
    expect(aggregator.aggregate(values, "MIN")).toBe(10);
  });

  it("MAX", () => {
    expect(aggregator.aggregate(values, "MAX")).toBe(30);
  });

  it("COUNT_DISTINCT", () => {
    expect(aggregator.aggregate(values, "COUNT_DISTINCT")).toBe(3);
  });

  it("bo'sh massiv — null", () => {
    expect(aggregator.aggregate([], "SUM")).toBeNull();
  });

  it("calculateVAT", () => {
    expect(aggregator.calculateVAT(100)).toBe(12);
  });

  it("calculateBonus", () => {
    expect(aggregator.calculateBonus(100, 80, 10)).toBe(10);
    expect(aggregator.calculateBonus(50, 80, 10)).toBe(0);
  });
});
