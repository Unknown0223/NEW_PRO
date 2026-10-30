import { randomBytes } from "node:crypto";
import { isRemoteObjectStorageEnabled, storagePut, storageReadBuffer } from "./storage.service";
import { Readable } from "stream";

const DATA_URL_RE = /^data:(image\/[a-z+]+);base64,(.+)$/i;

/** Fotootchyot saqlash: polka/vitrina o‘qiladi, disk/trafik yeyilmaydi. */
export const CLIENT_PHOTO_STORE_MAX_EDGE = 1600;
export const CLIENT_PHOTO_STORE_JPEG_QUALITY = 75;

export function decodeBase64Photo(input: string): { buffer: Buffer; contentType: string } | null {
  const trimmed = input.trim();
  const m = DATA_URL_RE.exec(trimmed);
  if (m) {
    return { contentType: m[1]!, buffer: Buffer.from(m[2]!, "base64") };
  }
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 80) {
    return { contentType: "image/jpeg", buffer: Buffer.from(trimmed, "base64") };
  }
  return null;
}

export function isClientPhotoStorageKey(stored: string): boolean {
  return stored.trim().startsWith("client-photos/");
}

/**
 * Telefon JPEG (3–8 MB / 4032 px) → ~100–180 KB JPEG.
 * Eski APK xom yuborsa ham server qayta siqadi.
 */
export async function compressClientPhotoForStore(buf: Buffer): Promise<Buffer> {
  if (!buf.length) return buf;
  try {
    const sharp = (await import("sharp")).default;
    const pipeline = sharp(buf, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    let out = pipeline;
    if (w > CLIENT_PHOTO_STORE_MAX_EDGE || h > CLIENT_PHOTO_STORE_MAX_EDGE) {
      out = out.resize({
        width: CLIENT_PHOTO_STORE_MAX_EDGE,
        height: CLIENT_PHOTO_STORE_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true
      });
    }
    const compressed = await out
      .jpeg({ quality: CLIENT_PHOTO_STORE_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    if (compressed.length > 0 && (buf.length > compressed.length || w > CLIENT_PHOTO_STORE_MAX_EDGE || h > CLIENT_PHOTO_STORE_MAX_EDGE)) {
      return compressed;
    }
    if (
      meta.format === "jpeg" &&
      w <= CLIENT_PHOTO_STORE_MAX_EDGE &&
      h <= CLIENT_PHOTO_STORE_MAX_EDGE &&
      buf.length <= 180_000
    ) {
      return buf;
    }
    return compressed.length > 0 ? compressed : buf;
  } catch {
    return buf;
  }
}

export async function readStoredClientPhoto(stored: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  const t = stored.trim();
  if (!t) return null;
  if (isClientPhotoStorageKey(t)) {
    const buf = await storageReadBuffer(t);
    if (!buf?.length) return null;
    return { buffer: buf, contentType: "image/jpeg" };
  }
  return decodeBase64Photo(t);
}

/**
 * R2 yoqilganda siqilgan JPEG ni object storage ga yozadi.
 * Yoqilmagan bo‘lsa — siqilgan data-URL (DB da 3–8 MB o‘rniga ~150 KB).
 */
export async function resolveClientPhotoImageUrl(
  tenantId: number,
  clientId: number,
  imageInput: string
): Promise<string> {
  const decoded = decodeBase64Photo(imageInput);
  if (!decoded) {
    return imageInput;
  }
  const compressed = await compressClientPhotoForStore(decoded.buffer);
  if (isRemoteObjectStorageEnabled()) {
    const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.jpg`;
    const prefix = `client-photos/${tenantId}/${clientId}`;
    const result = await storagePut(
      prefix,
      filename,
      Readable.from(compressed),
      "image/jpeg",
      compressed.length + 1
    );
    if (result.url) return result.url;
    return result.key;
  }
  return `data:image/jpeg;base64,${compressed.toString("base64")}`;
}
