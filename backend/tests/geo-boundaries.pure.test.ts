import { describe, expect, it } from "vitest";

import {
  clipPolygonOutsideObstacles,
  polygonsHaveAreaOverlap,
  subtractPolygons
} from "../src/modules/geo-boundaries/geo-polygon.util";

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

const POLY_TOUCH = [
  { lat: 41.35, lng: 69.2 },
  { lat: 41.4, lng: 69.2 },
  { lat: 41.4, lng: 69.28 },
  { lat: 41.35, lng: 69.28 }
];

describe("geo polygon overlap (branch / zone / territory)", () => {
  it("detects area overlap between polygons", () => {
    expect(polygonsHaveAreaOverlap(POLY_A, POLY_B)).toBe(true);
  });

  it("does not treat edge-touch as overlap", () => {
    expect(polygonsHaveAreaOverlap(POLY_A, POLY_TOUCH)).toBe(false);
  });

  it("existing_wins clip keeps subject outside obstacle", () => {
    const res = clipPolygonOutsideObstacles(POLY_B, [POLY_A]);
    expect(res.valid).toBe(true);
    expect(res.clipped).toBe(true);
    expect(res.polygon.length).toBeGreaterThanOrEqual(3);
    expect(polygonsHaveAreaOverlap(res.polygon, POLY_A)).toBe(false);
  });

  it("incoming_wins clip trims obstacle outside incoming", () => {
    const res = subtractPolygons(POLY_A, [POLY_B]);
    expect(res.valid).toBe(true);
    expect(res.clipped).toBe(true);
    expect(polygonsHaveAreaOverlap(res.polygon, POLY_B)).toBe(false);
  });

  it("fully inside polygon is removed on incoming_wins clip", () => {
    const inside = [
      { lat: 41.31, lng: 69.23 },
      { lat: 41.33, lng: 69.23 },
      { lat: 41.33, lng: 69.27 },
      { lat: 41.31, lng: 69.27 }
    ];
    const res = subtractPolygons(inside, [POLY_A]);
    expect(res.removed).toBe(true);
    expect(res.valid).toBe(false);
  });
});
