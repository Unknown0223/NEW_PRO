import { describe, expect, it } from "vitest";
import { compressImageForFaceUpload, isLikelyImageFile, sniffImageMime } from "@/lib/staff-face-drop";

describe("staff-face-drop", () => {
  it("sniffs jpeg/png magic", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]).buffer;
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).buffer;
    expect(sniffImageMime(png)).toBe("image/png");
  });

  it("accepts telegram-like empty mime / octet-stream", () => {
    expect(isLikelyImageFile(new File([""], "photo", { type: "" }))).toBe(true);
    expect(
      isLikelyImageFile(new File([""], "x.bin", { type: "application/octet-stream" }))
    ).toBe(true);
    expect(isLikelyImageFile(new File([""], "a.jpg", { type: "image/jpeg" }))).toBe(true);
  });

  it("compressImageForFaceUpload returns a file", async () => {
    // Minimal valid-ish JPEG header; createImageBitmap may fail in jsdom → returns original
    const raw = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])], "t.jpg", {
      type: "image/jpeg"
    });
    const out = await compressImageForFaceUpload(raw);
    expect(out).toBeInstanceOf(File);
    expect(out.size).toBeGreaterThan(0);
  });
});
