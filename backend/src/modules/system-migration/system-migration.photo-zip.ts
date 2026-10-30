/**
 * Fotootchyot eksporti: base64/data-URL ni ZIP ichidagi binary faylga ajratadi —
 * bitta JSON ichida o‘nlab MB bo‘lib RAM/timeout bermasligi uchun.
 * Katta telefon rasmlari sharp orqali siqiladi (aks holda ZIP 1–2+ GB bo‘ladi).
 */
import { decodeStoredPhotoContent, isInlineHeavyPhotoUrl } from "../dashboard/dashboard.supervisor.photo-reports";

export const PHOTO_ZIP_PREFIX = "files/client_photos/";
export const PHOTO_ZIP_URI_PREFIX = "zip://files/client_photos/";

/** Zaxira uchun max tomon (px). */
export const PHOTO_BACKUP_MAX_EDGE = 1280;
/** JPEG sifat (1–100). */
export const PHOTO_BACKUP_JPEG_QUALITY = 72;
/** Siqish ishlamasa va shundan katta bo‘lsa — meta qoladi, binary tashlanadi. */
export const PHOTO_BACKUP_HARD_MAX_BYTES = 900_000;

export function photoZipEntryPath(photoId: number, contentType: string): string {
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return `${PHOTO_ZIP_PREFIX}${photoId}.${ext}`;
}

export function photoZipUri(entryPath: string): string {
  return `zip://${entryPath.replace(/^\/+/, "")}`;
}

export function parsePhotoZipUri(imageUrl: string): string | null {
  const t = imageUrl.trim();
  if (!t.startsWith("zip://")) return null;
  const path = t.slice("zip://".length).replace(/^\/+/, "");
  if (!path.startsWith(PHOTO_ZIP_PREFIX)) return null;
  return path;
}

export type PhotoExportRow = Record<string, unknown> & {
  id: number;
  image_url: string;
};

export type PhotoZipBinary = { path: string; buffer: Buffer };

/**
 * Migratsiya ZIP uchun rasmni qayta kodlaydi — 3–6 MB telefon JPEG → ~100–250 KB.
 */
export async function compressPhotoForBackup(
  buf: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string; stripped: boolean }> {
  if (!buf.length) {
    return { buffer: buf, contentType, stripped: true };
  }
  // Kichik fayllarni qayta kodlamaslik — tezroq.
  if (buf.length <= 180_000) {
    return { buffer: buf, contentType, stripped: false };
  }
  try {
    const sharp = (await import("sharp")).default;
    const pipeline = sharp(buf, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    let out = pipeline;
    if (w > PHOTO_BACKUP_MAX_EDGE || h > PHOTO_BACKUP_MAX_EDGE) {
      out = out.resize({
        width: PHOTO_BACKUP_MAX_EDGE,
        height: PHOTO_BACKUP_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true
      });
    }
    const compressed = await out
      .jpeg({ quality: PHOTO_BACKUP_JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
    if (compressed.length > 0 && compressed.length < buf.length) {
      return { buffer: compressed, contentType: "image/jpeg", stripped: false };
    }
    if (buf.length > PHOTO_BACKUP_HARD_MAX_BYTES) {
      return { buffer: Buffer.alloc(0), contentType, stripped: true };
    }
    return { buffer: buf, contentType, stripped: false };
  } catch {
    if (buf.length > PHOTO_BACKUP_HARD_MAX_BYTES) {
      return { buffer: Buffer.alloc(0), contentType, stripped: true };
    }
    return { buffer: buf, contentType, stripped: false };
  }
}

/**
 * Og‘ir inline rasmlarni binary ZIP entry ga ajratadi; JSON da faqat zip:// URI qoladi.
 * HTTPS URL lar o‘zgarishsiz.
 */
export async function splitPhotoReportsForZip(rows: PhotoExportRow[]): Promise<{
  rows: PhotoExportRow[];
  binaries: PhotoZipBinary[];
  strippedCount: number;
}> {
  const binaries: PhotoZipBinary[] = [];
  let strippedCount = 0;
  const out: PhotoExportRow[] = new Array(rows.length);
  const CONCURRENCY = 6;

  async function processOne(row: PhotoExportRow, index: number): Promise<void> {
    const url = String(row.image_url ?? "").trim();
    if (!url) {
      out[index] = row;
      return;
    }
    if (!isInlineHeavyPhotoUrl(url)) {
      out[index] = row;
      return;
    }
    const decoded = decodeStoredPhotoContent(url);
    if (!decoded || decoded.buffer.length === 0) {
      strippedCount += 1;
      out[index] = {
        ...row,
        image_url: "",
        content_purged_at: row.content_purged_at ?? new Date().toISOString()
      };
      return;
    }
    const compressed = await compressPhotoForBackup(decoded.buffer, decoded.contentType);
    if (compressed.stripped || !compressed.buffer.length) {
      strippedCount += 1;
      out[index] = {
        ...row,
        image_url: "",
        content_purged_at: row.content_purged_at ?? new Date().toISOString()
      };
      return;
    }
    const path = photoZipEntryPath(Number(row.id), compressed.contentType);
    binaries.push({ path, buffer: compressed.buffer });
    out[index] = { ...row, image_url: photoZipUri(path) };
  }

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map((row, j) => processOne(row, i + j)));
  }

  return { rows: out, binaries, strippedCount };
}
