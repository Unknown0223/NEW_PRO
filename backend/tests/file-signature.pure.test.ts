import { describe, expect, it } from "vitest";
import { assertFileKind, detectFileKind } from "../src/lib/file-signature.pure";

describe("detectFileKind", () => {
  it("detects jpeg/png/pdf/zip", () => {
    expect(detectFileKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectFileKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(detectFileKind(Buffer.from("%PDF-1.4"))).toBe("pdf");
    expect(detectFileKind(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe("zip");
  });

  it("detects webp", () => {
    const buf = Buffer.alloc(12);
    buf.write("RIFF", 0);
    buf.write("WEBP", 8);
    expect(detectFileKind(buf)).toBe("webp");
  });

  it("rejects unknown", () => {
    expect(detectFileKind(Buffer.from("hello"))).toBe("unknown");
    expect(() => assertFileKind(Buffer.from("hello"), ["zip"])).toThrow("FILE_TYPE_MISMATCH");
  });
});
