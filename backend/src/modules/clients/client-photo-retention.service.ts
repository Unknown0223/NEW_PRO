/**
 * Fotootchet rasm kontentini saqlash muddati (default 60 kun).
 * Qator o‘chirilmaydi — faqat image_url tozalanadi (son/statistikalar saqlanadi).
 */
import { env } from "../../config/env";
import { prisma } from "../../config/database";
import { storageDelete } from "../../lib/storage.service";

/** DB da bo‘sh joy belgilovchi (UI rasm ko‘rsatmaydi). */
export const PHOTO_CONTENT_PURGED_MARKER = "";

export type PhotoContentPurgeResult = {
  retention_days: number;
  cutoff_iso: string;
  scanned: number;
  purged: number;
  storage_deleted: number;
};

function tryExtractStorageKey(imageUrl: string): string | null {
  const t = imageUrl.trim();
  if (!t) return null;
  // Bizning prefix: client-photos/{tenant}/{client}/...
  if (t.startsWith("client-photos/")) return t;
  try {
    const u = new URL(t);
    const path = u.pathname.replace(/^\/+/, "");
    const idx = path.indexOf("client-photos/");
    if (idx >= 0) return path.slice(idx);
  } catch {
    /* not a URL */
  }
  return null;
}

/**
 * created_at < cutoff bo‘lgan va hali purge qilinmagan fotolarning
 * og‘ir image_url ni bo‘shatadi. Remote storage bo‘lsa — best-effort delete.
 */
export async function purgeExpiredPhotoContent(opts?: {
  retentionDays?: number;
  batchSize?: number;
}): Promise<PhotoContentPurgeResult> {
  const days = Math.max(1, Math.floor(opts?.retentionDays ?? env.PHOTO_CONTENT_RETENTION_DAYS));
  const batchSize = Math.min(500, Math.max(50, Math.floor(opts?.batchSize ?? 200)));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let scanned = 0;
  let purged = 0;
  let storage_deleted = 0;

  for (;;) {
    const rows = await prisma.clientPhotoReport.findMany({
      where: {
        content_purged_at: null,
        created_at: { lt: cutoff },
        NOT: { image_url: PHOTO_CONTENT_PURGED_MARKER }
      },
      select: { id: true, image_url: true },
      take: batchSize,
      orderBy: { created_at: "asc" }
    });
    if (rows.length === 0) break;
    scanned += rows.length;

    for (const row of rows) {
      const key = tryExtractStorageKey(row.image_url);
      if (key) {
        try {
          await storageDelete(key);
          storage_deleted += 1;
        } catch {
          /* best-effort */
        }
      }
    }

    const ids = rows.map((r) => r.id);
    const updated = await prisma.clientPhotoReport.updateMany({
      where: { id: { in: ids }, content_purged_at: null },
      data: {
        image_url: PHOTO_CONTENT_PURGED_MARKER,
        content_purged_at: new Date()
      }
    });
    purged += updated.count;

    if (rows.length < batchSize) break;
  }

  return {
    retention_days: days,
    cutoff_iso: cutoff.toISOString(),
    scanned,
    purged,
    storage_deleted
  };
}
