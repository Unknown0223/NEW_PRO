import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildFaceDescriptor } from "../src/modules/mobile/face-match.descriptor";
import { decideFaceMatch, faceMatchScore } from "../src/modules/mobile/face-match.pure";

async function makePhoto(seed: number): Promise<Buffer> {
  // Distinct textured “faces” for deterministic compare tests
  const size = 200;
  const raw = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      raw[i] = (x * 3 + seed * 17) % 220 + 20;
      raw[i + 1] = (y * 5 + seed * 31) % 200 + 30;
      raw[i + 2] = ((x + y) * 2 + seed * 7) % 180 + 40;
    }
  }
  // oval brighter region (pseudo-face)
  for (let y = 40; y < 160; y++) {
    for (let x = 50; x < 150; x++) {
      const dx = (x - 100) / 45;
      const dy = (y - 100) / 55;
      if (dx * dx + dy * dy < 1) {
        const i = (y * size + x) * 3;
        raw[i] = Math.min(255, raw[i]! + 60 + (seed % 20));
        raw[i + 1] = Math.min(255, raw[i + 1]! + 40);
        raw[i + 2] = Math.min(255, raw[i + 2]! + 30);
      }
    }
  }
  return sharp(raw, { raw: { width: size, height: size, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("face-match.descriptor", () => {
  it("same image matches itself above threshold", async () => {
    const img = await makePhoto(1);
    const a = await buildFaceDescriptor(img);
    const b = await buildFaceDescriptor(img);
    const score = faceMatchScore(a, b);
    expect(score).toBeGreaterThan(0.98);
    expect(decideFaceMatch(score)).toBe("approved");
  });

  it("different images score lower than identical and below threshold", async () => {
    const a = await buildFaceDescriptor(await makePhoto(1));
    const b = await buildFaceDescriptor(await makePhoto(99));
    const same = faceMatchScore(a, a);
    const diff = faceMatchScore(a, b);
    expect(same).toBeGreaterThan(diff);
    expect(decideFaceMatch(diff)).toBe("rejected");
  });

  it("blank image throws FACE_IMAGE_BLANK", async () => {
    const blank = await sharp({
      create: { width: 120, height: 120, channels: 3, background: { r: 128, g: 128, b: 128 } }
    })
      .jpeg()
      .toBuffer();
    await expect(buildFaceDescriptor(blank)).rejects.toThrow(/FACE_IMAGE_BLANK/);
  });
});
