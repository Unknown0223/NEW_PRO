import { describe, expect, it } from "vitest";
import {
  compressClientPhotoForStore,
  CLIENT_PHOTO_STORE_MAX_EDGE
} from "../src/lib/client-photo-storage";

describe("compressClientPhotoForStore", () => {
  it("shrinks a large noisy jpeg under 250 KB", async () => {
    const sharp = (await import("sharp")).default;
    const w = 3200;
    const h = 2400;
    const noise = Buffer.alloc(w * h * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 17 + 31) & 0xff;
    const big = await sharp(noise, { raw: { width: w, height: h, channels: 3 } })
      .jpeg({ quality: 95 })
      .toBuffer();
    expect(big.length).toBeGreaterThan(400_000);

    const out = await compressClientPhotoForStore(big);
    const meta = await sharp(out).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(CLIENT_PHOTO_STORE_MAX_EDGE);
    expect(out.length).toBeLessThan(250_000);
    expect(out.length).toBeLessThan(big.length);
  });
});
