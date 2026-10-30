import { describe, expect, it } from "vitest";
import {
  cosineSimilarity,
  decideFaceMatch,
  faceMatchScore,
  l2Normalize,
  parseDescriptor
} from "../src/modules/mobile/face-match.pure";

describe("face-match.pure", () => {
  it("cosineSimilarity is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });

  it("faceMatchScore rejects orthogonal vectors", () => {
    expect(faceMatchScore([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("decideFaceMatch uses threshold", () => {
    expect(decideFaceMatch(0.9, 0.88)).toBe("approved");
    expect(decideFaceMatch(0.8, 0.88)).toBe("rejected");
  });

  it("parseDescriptor validates length", () => {
    expect(parseDescriptor([1, 2])).toBeNull();
    expect(parseDescriptor(Array.from({ length: 16 }, (_, i) => i))).toHaveLength(16);
  });

  it("l2Normalize preserves direction", () => {
    const n = l2Normalize([3, 4]);
    expect(Math.hypot(n[0]!, n[1]!)).toBeCloseTo(1, 6);
  });
});
