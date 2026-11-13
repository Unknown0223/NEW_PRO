import fs from "fs";
import path from "path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildFaceDescriptor } from "../src/modules/mobile/face-match.descriptor";
import {
  decideFaceMatch,
  euclideanDistance,
  faceMatchScore
} from "../src/modules/mobile/face-match.pure";

const sampleDir = path.join(
  process.cwd(),
  "node_modules",
  "@vladmandic",
  "face-api",
  "demo"
);

function sample(name: string): Buffer {
  return fs.readFileSync(path.join(sampleDir, name));
}

describe("face-match.descriptor (FaceRecognitionNet)", () => {
  it(
    "same face image matches itself above threshold",
    async () => {
      const img = sample("sample1.jpg");
      const a = await buildFaceDescriptor(img);
      const b = await buildFaceDescriptor(img);
      expect(a).toHaveLength(128);
      expect(euclideanDistance(a, b)).toBeLessThan(0.05);
      const score = faceMatchScore(a, b);
      expect(score).toBeGreaterThan(0.95);
      expect(decideFaceMatch(score)).toBe("approved");
    },
    60_000
  );

  it(
    "same person under mild jpeg recompress still matches",
    async () => {
      const orig = sample("sample1.jpg");
      const recompressed = await sharp(orig).jpeg({ quality: 55 }).toBuffer();
      const a = await buildFaceDescriptor(orig);
      const b = await buildFaceDescriptor(recompressed);
      const dist = euclideanDistance(a, b);
      expect(dist).toBeLessThan(0.45);
      expect(decideFaceMatch(faceMatchScore(a, b))).toBe("approved");
    },
    60_000
  );

  it(
    "different people score below threshold",
    async () => {
      const a = await buildFaceDescriptor(sample("sample1.jpg"));
      const b = await buildFaceDescriptor(sample("sample5.jpg"));
      const dist = euclideanDistance(a, b);
      expect(dist).toBeGreaterThan(0.55);
      expect(decideFaceMatch(faceMatchScore(a, b))).toBe("rejected");
    },
    60_000
  );

  it(
    "blank image throws FACE_IMAGE_BLANK or FACE_NOT_DETECTED",
    async () => {
      const blank = await sharp({
        create: { width: 120, height: 120, channels: 3, background: { r: 128, g: 128, b: 128 } }
      })
        .jpeg()
        .toBuffer();
      await expect(buildFaceDescriptor(blank)).rejects.toThrow(/FACE_(IMAGE_BLANK|NOT_DETECTED)/);
    },
    60_000
  );
});
