/** Fayl magic-byte aniqlash (upload himoya). */

export type DetectedFileKind =
  | "jpeg"
  | "png"
  | "webp"
  | "pdf"
  | "zip"
  | "unknown";

export function detectFileKind(buf: Buffer | Uint8Array): DetectedFileKind {
  if (!buf || buf.length < 4) return "unknown";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "webp";
  }
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "pdf";
  // xlsx / apk / zip
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) {
    return "zip";
  }
  return "unknown";
}

export function assertFileKind(
  buf: Buffer | Uint8Array,
  allowed: readonly DetectedFileKind[]
): DetectedFileKind {
  const kind = detectFileKind(buf);
  if (!allowed.includes(kind)) {
    throw new Error("FILE_TYPE_MISMATCH");
  }
  return kind;
}
