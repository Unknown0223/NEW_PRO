import { describe, expect, it } from "vitest";
import {
  intersectNumberSets,
  intersectNumberSetsSkippingEmpty
} from "../src/modules/linkage/linkage.shared";

describe("intersectNumberSetsSkippingEmpty", () => {
  it("ignores empty sets so agent warehouses survive client-without-wh", () => {
    const clientWh = new Set<number>();
    const agentWh = new Set<number>([17, 18]);
    expect(intersectNumberSets([clientWh, agentWh])).toEqual([]);
    expect(intersectNumberSetsSkippingEmpty([clientWh, agentWh]).sort()).toEqual([17, 18]);
  });

  it("still intersects when both sides have ids", () => {
    expect(
      intersectNumberSetsSkippingEmpty([new Set([17, 18]), new Set([17, 99])]).sort()
    ).toEqual([17]);
  });

  it("returns [] when every set is empty", () => {
    expect(intersectNumberSetsSkippingEmpty([new Set(), new Set()])).toEqual([]);
  });
});
