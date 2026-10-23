import { describe, expect, it } from "vitest";
import {
  compressPhotoForBackup,
  splitPhotoReportsForZip,
  parsePhotoZipUri
} from "../src/modules/system-migration/system-migration.photo-zip";

describe("system-migration photo zip", () => {
  it("moves heavy data-url into binary zip entries", async () => {
    const raw = Buffer.from("hello-photo").toString("base64");
    const { rows, binaries, strippedCount } = await splitPhotoReportsForZip([
      {
        id: 9,
        image_url: `data:image/jpeg;base64,${raw}`,
        caption: "A"
      },
      {
        id: 10,
        image_url: "https://cdn.example.com/a.jpg",
        caption: "B"
      }
    ]);
    expect(strippedCount).toBe(0);
    expect(binaries).toHaveLength(1);
    expect(binaries[0]!.path).toContain("files/client_photos/9.");
    expect(rows[0]!.image_url.startsWith("zip://")).toBe(true);
    expect(parsePhotoZipUri(rows[0]!.image_url)).toBe(binaries[0]!.path);
    expect(rows[1]!.image_url).toBe("https://cdn.example.com/a.jpg");
  });

  it("compresses large jpeg buffers for backup", async () => {
    const sharp = (await import("sharp")).default;
    // Shovqinli rasm — sifat 95 da ham 180KB+ bo‘lsin (siqish yo‘li tekshiriladi).
    const noise = Buffer.alloc(1600 * 1200 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 17 + 31) & 0xff;
    const big = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } })
      .jpeg({ quality: 95 })
      .toBuffer();
    expect(big.length).toBeGreaterThan(180_000);
    const out = await compressPhotoForBackup(big, "image/jpeg");
    expect(out.stripped).toBe(false);
    expect(out.contentType).toBe("image/jpeg");
    expect(out.buffer.length).toBeLessThan(big.length);
    expect(out.buffer.length).toBeLessThan(400_000);
  });
});
