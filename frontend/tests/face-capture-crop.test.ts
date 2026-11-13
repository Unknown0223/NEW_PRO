import { describe, expect, it } from "vitest";
import { faceBoundingBoxFromLandmarks } from "@/lib/face-capture-crop";

describe("faceBoundingBoxFromLandmarks", () => {
  it("returns padded box from landmark cloud", () => {
    const box = faceBoundingBoxFromLandmarks([
      { x: 0.4, y: 0.35 },
      { x: 0.6, y: 0.35 },
      { x: 0.5, y: 0.55 }
    ]);
    expect(box).not.toBeNull();
    expect(box!.w).toBeGreaterThan(0.2);
    expect(box!.h).toBeGreaterThan(0.2);
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
  });

  it("rejects empty landmarks", () => {
    expect(faceBoundingBoxFromLandmarks([])).toBeNull();
  });
});
