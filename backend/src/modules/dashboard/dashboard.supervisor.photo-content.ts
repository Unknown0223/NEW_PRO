import { prisma } from "../../config/database";
import { readStoredClientPhoto } from "../../lib/client-photo-storage";
import {
  decodeStoredPhotoContent,
  supervisorPhotoContentPath,
  type SupervisorPhotoReportImage
} from "./dashboard.supervisor.photo-reports";

export async function fetchSupervisorPhotoImages(
  tenantId: number,
  tenantSlug: string,
  photoIds: number[]
): Promise<SupervisorPhotoReportImage[]> {
  const ids = [...new Set(photoIds)].filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length === 0) return [];
  // image_url (base64 TEXT) ni select QILMAYMIZ — faqat meta + proxy URL.
  const rows = await prisma.clientPhotoReport.findMany({
    where: { tenant_id: tenantId, id: { in: ids.slice(0, 100) }, deleted_at: null },
    select: { id: true, caption: true, created_at: true }
  });
  return rows.map((r) => ({
    id: r.id,
    image_url: supervisorPhotoContentPath(tenantSlug, r.id),
    caption: r.caption,
    created_at: r.created_at.toISOString()
  }));
}

const photoContentCache = new Map<string, { buffer: Buffer; contentType: string }>();
const PHOTO_CONTENT_CACHE_MAX = 96;
const REMOTE_PHOTO_MAX_BYTES = 12 * 1024 * 1024;
const THUMB_MAX_EDGE = 480;

function photoCacheKey(photoId: number, thumb: boolean): string {
  return `${photoId}:${thumb ? "t" : "f"}`;
}

function rememberPhotoContent(photoId: number, buffer: Buffer, contentType: string, thumb: boolean) {
  if (photoContentCache.size >= PHOTO_CONTENT_CACHE_MAX) {
    const oldest = photoContentCache.keys().next().value;
    if (oldest != null) photoContentCache.delete(oldest);
  }
  photoContentCache.set(photoCacheKey(photoId, thumb), { buffer, contentType });
}

/** Grid/lenta uchun kichik JPEG — to‘liq 1.6k rasm o‘rniga. */
export async function shrinkPhotoThumb(buffer: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({
        width: THUMB_MAX_EDGE,
        height: THUMB_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: 62, mozjpeg: true })
      .toBuffer();
    return out.length > 0 ? out : buffer;
  } catch {
    return buffer;
  }
}

/** 302 → CDN/S3 brauzerda CORS tufayli «…» da qotib qoladi; server o‘zi olib beradi. */
export function isSafeRemotePhotoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const h = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") {
      return false;
    }
    if (/^(10\.|192\.168\.|169\.254\.)/.test(h)) return false;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return false;
    if (h.endsWith(".internal") || h.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function fetchRemotePhotoBytes(
  url: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isSafeRemotePhotoUrl(url)) return null;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]!.trim().toLowerCase();
    if (!(ct.startsWith("image/") || ct === "application/octet-stream")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > REMOTE_PHOTO_MAX_BYTES) return null;
    return { buffer: buf, contentType: ct.startsWith("image/") ? ct : "image/jpeg" };
  } catch {
    return null;
  }
}

async function asThumbBytes(
  photoId: number,
  buffer: Buffer
): Promise<{ buffer: Buffer; contentType: string }> {
  const cached = photoContentCache.get(photoCacheKey(photoId, true));
  if (cached) return cached;
  const thumb = await shrinkPhotoThumb(buffer);
  const packed = { buffer: thumb, contentType: "image/jpeg" };
  rememberPhotoContent(photoId, packed.buffer, packed.contentType, true);
  return packed;
}

export async function loadSupervisorPhotoContent(
  tenantId: number,
  photoId: number,
  opts?: { thumb?: boolean }
): Promise<
  | { kind: "redirect"; url: string }
  | { kind: "bytes"; buffer: Buffer; contentType: string }
  | null
> {
  const thumb = opts?.thumb === true;
  const hit = photoContentCache.get(photoCacheKey(photoId, thumb));
  if (hit) return { kind: "bytes", buffer: hit.buffer, contentType: hit.contentType };
  if (thumb) {
    const full = photoContentCache.get(photoCacheKey(photoId, false));
    if (full) {
      const small = await asThumbBytes(photoId, full.buffer);
      return { kind: "bytes", buffer: small.buffer, contentType: small.contentType };
    }
  }

  const row = await prisma.clientPhotoReport.findFirst({
    where: { id: photoId, tenant_id: tenantId, deleted_at: null },
    select: { image_url: true, content_purged_at: true }
  });
  if (!row || row.content_purged_at != null) return null;
  const stored = String(row.image_url ?? "").trim();
  if (!stored) return null;
  // zip:// migratsiya URI — diskdagi ZIP yo‘q, base64 deb o‘qimaslik.
  if (stored.startsWith("zip://")) return null;
  if (/^https?:\/\//i.test(stored)) {
    const remote = await fetchRemotePhotoBytes(stored);
    if (!remote) return null;
    rememberPhotoContent(photoId, remote.buffer, remote.contentType, false);
    if (!thumb) return { kind: "bytes", buffer: remote.buffer, contentType: remote.contentType };
    const small = await asThumbBytes(photoId, remote.buffer);
    return { kind: "bytes", buffer: small.buffer, contentType: small.contentType };
  }
  // Ichki /uploads/... — Fastify static; /api/... content o‘ziga loop qilmasin.
  if (stored.startsWith("/") && !stored.startsWith("/api/")) {
    return { kind: "redirect", url: stored };
  }
  const fromStore = await readStoredClientPhoto(stored);
  const decoded = fromStore ?? decodeStoredPhotoContent(stored);
  if (!decoded) return null;
  rememberPhotoContent(photoId, decoded.buffer, decoded.contentType, false);
  if (!thumb) return { kind: "bytes", buffer: decoded.buffer, contentType: decoded.contentType };
  const small = await asThumbBytes(photoId, decoded.buffer);
  return { kind: "bytes", buffer: small.buffer, contentType: small.contentType };
}
