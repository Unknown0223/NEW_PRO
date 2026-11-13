import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  decideFaceMatch,
  euclideanDistance,
  faceMatchScore,
  l2Normalize,
  parseDescriptor
} from "../src/modules/mobile/face-match.pure";

describe("face-match.pure", () => {
  it("euclideanDistance is 0 for identical vectors", () => {
    expect(euclideanDistance([1, 2, 3], [1, 2, 3])).toBeCloseTo(0, 6);
  });

  it("faceMatchScore is 1 for identical vectors", () => {
    expect(faceMatchScore([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });

  it("faceMatchScore maps distance 0.55 to threshold boundary", () => {
    // Construct vectors with euclid ≈ 0.55 → score ≈ 0.45
    const a = [0, 0];
    const b = [0.55, 0];
    expect(euclideanDistance(a, b)).toBeCloseTo(0.55, 6);
    expect(faceMatchScore(a, b)).toBeCloseTo(0.45, 6);
  });

  it("decideFaceMatch uses threshold", () => {
    expect(decideFaceMatch(0.6, 0.45)).toBe("approved");
    expect(decideFaceMatch(0.3, 0.45)).toBe("rejected");
  });

  it("rejected string must not be treated as success in boolean context", () => {
    const decision = decideFaceMatch(0.2, 0.45);
    expect(decision === "approved").toBe(false);
    expect(Boolean(decision)).toBe(true); // string is truthy — callers must compare === "approved"
  });

  it("parseDescriptor validates length", () => {
    expect(parseDescriptor([1, 2])).toBeNull();
    expect(parseDescriptor(Array.from({ length: 16 }, (_, i) => i))).toHaveLength(16);
  });

  it("l2Normalize preserves direction", () => {
    const n = l2Normalize([3, 4]);
    expect(Math.hypot(n[0]!, n[1]!)).toBeCloseTo(1, 6);
  });

  it("cosineSimilarity is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });
});
