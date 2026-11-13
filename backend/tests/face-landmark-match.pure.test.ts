import { describe, expect, it } from "vitest";
import {
  buildLandmarkDescriptor,
  decideLandmarkMatch,
  landmarkMatchScore
} from "../src/modules/mobile/face-landmark-match.pure";

function fakeMesh(seed = 1): Array<{ x: number; y: number }> {
  const pts = Array.from({ length: 478 }, (_, i) => ({
    x: 0.3 + ((i * 17 + seed * 3) % 40) / 100,
    y: 0.25 + ((i * 13 + seed * 5) % 45) / 100
  }));
  // Stable key points roughly like a frontal face
  pts[1] = { x: 0.5, y: 0.48 };
  pts[33] = { x: 0.38, y: 0.42 };
  pts[263] = { x: 0.62, y: 0.42 };
  pts[133] = { x: 0.44, y: 0.42 };
  pts[362] = { x: 0.56, y: 0.42 };
  pts[10] = { x: 0.5, y: 0.28 };
  pts[152] = { x: 0.5, y: 0.72 };
  pts[61] = { x: 0.42, y: 0.58 };
  pts[291] = { x: 0.58, y: 0.58 };
  pts[13] = { x: 0.5, y: 0.55 };
  pts[14] = { x: 0.5, y: 0.62 };
  pts[234] = { x: 0.32, y: 0.52 };
  pts[454] = { x: 0.68, y: 0.52 };
  return pts;
}

describe("face-landmark-match.pure", () => {
  it("same mesh scores near 1", () => {
    const a = buildLandmarkDescriptor(fakeMesh(1));
    const b = buildLandmarkDescriptor(fakeMesh(1));
    expect(a).not.toBeNull();
    expect(landmarkMatchScore(a!, b!)).toBeGreaterThan(0.99);
    expect(decideLandmarkMatch(landmarkMatchScore(a!, b!))).toBe(true);
  });

  it("different mesh scores lower", () => {
    const aMesh = fakeMesh(1);
    const bMesh = fakeMesh(1);
    bMesh[152] = { x: 0.5, y: 0.9 };
    bMesh[10] = { x: 0.5, y: 0.12 };
    bMesh[234] = { x: 0.2, y: 0.55 };
    const a = buildLandmarkDescriptor(aMesh)!;
    const b = buildLandmarkDescriptor(bMesh)!;
    expect(landmarkMatchScore(a, a)).toBeGreaterThan(landmarkMatchScore(a, b));
  });
});
