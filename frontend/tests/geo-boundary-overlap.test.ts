import { describe, expect, it } from "vitest";

import type { GeoBoundary } from "@/lib/geo-boundaries-types";
import { findGeoBoundaryOverlapConflicts, polygonsHaveAreaOverlap } from "@/lib/geo-polygon";

const POLY_A = [
  { lat: 41.3, lng: 69.2 },
  { lat: 41.35, lng: 69.2 },
  { lat: 41.35, lng: 69.28 },
  { lat: 41.3, lng: 69.28 }
];

const POLY_B = [
  { lat: 41.32, lng: 69.22 },
  { lat: 41.37, lng: 69.22 },
  { lat: 41.37, lng: 69.3 },
  { lat: 41.32, lng: 69.3 }
];

function boundary(
  kind: GeoBoundary["kind"],
  refId: string,
  polygon: { lat: number; lng: number }[]
): GeoBoundary {
  return {
    id: `gb-${refId}`,
    kind,
    ref_id: refId,
    name: refId,
    polygon,
    updated_at: new Date().toISOString()
  };
}

describe("findGeoBoundaryOverlapConflicts", () => {
  it("detects branch vs incoming zone overlap", () => {
    const existing = [boundary("branch", "b1", POLY_A)];
    const conflicts = findGeoBoundaryOverlapConflicts(POLY_B, existing, "zone", "z1");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe("branch");
  });

  it("detects zone vs incoming territory overlap", () => {
    const existing = [boundary("zone", "z1", POLY_A)];
    const conflicts = findGeoBoundaryOverlapConflicts(POLY_B, existing, "territory", "t1");
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe("zone");
  });

  it("ignores same ref_id boundary", () => {
    const existing = [boundary("zone", "z1", POLY_A)];
    const conflicts = findGeoBoundaryOverlapConflicts(POLY_B, existing, "zone", "z1");
    expect(conflicts).toHaveLength(0);
  });

  it("does not flag edge-touch as overlap", () => {
    const touch = [
      { lat: 41.35, lng: 69.2 },
      { lat: 41.4, lng: 69.2 },
      { lat: 41.4, lng: 69.28 },
      { lat: 41.35, lng: 69.28 }
    ];
    expect(polygonsHaveAreaOverlap(POLY_A, touch)).toBe(false);
    const conflicts = findGeoBoundaryOverlapConflicts(touch, [boundary("branch", "b1", POLY_A)], "zone", "z1");
    expect(conflicts).toHaveLength(0);
  });
});
