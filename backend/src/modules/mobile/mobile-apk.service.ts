import { join } from "path";
import type { Readable } from "stream";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from "fs";
import { pipeline } from "stream/promises";
import { Readable as NodeReadable } from "stream";
import { env } from "../../config/env";
import {
  isRemoteObjectStorageEnabled,
  storagePutFile,
  storageReadBuffer
} from "../../lib/storage.service";

export const MOBILE_APK_MAX_BYTES = env.MULTIPART_APK_MAX_BYTES;

const UPLOAD_ROOT = join(process.cwd(), "uploads", "mobile");

export function mobileApkFilePath(tenantSlug: string): string {
  return join(UPLOAD_ROOT, tenantSlug, "app-release.apk");
}

function remoteApkKey(tenantSlug: string): string {
  return `mobile/${tenantSlug}/app-release.apk`;
}

export function mobileApkExists(tenantSlug: string): boolean {
  return existsSync(mobileApkFilePath(tenantSlug));
}

export function mobileApkStat(tenantSlug: string): { size: number; mtimeMs: number } | null {
  const p = mobileApkFilePath(tenantSlug);
  if (!existsSync(p)) return null;
  const st = statSync(p);
  return { size: st.size, mtimeMs: st.mtimeMs };
}

/** Lokal yo‘q bo‘lsa R2/S3 dan tiklaydi (Railway redeploy uchun). */
export async function ensureMobileApkLocal(tenantSlug: string): Promise<boolean> {
  if (mobileApkExists(tenantSlug)) return true;
  if (!isRemoteObjectStorageEnabled()) return false;
  const buf = await storageReadBuffer(remoteApkKey(tenantSlug));
  if (!buf || buf.length < 1024) return false;
  const dir = join(UPLOAD_ROOT, tenantSlug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(mobileApkFilePath(tenantSlug), buf);
  return true;
}

export async function mobileApkReady(
  tenantSlug: string
): Promise<{ ready: boolean; bytes: number | null; mtime_ms: number | null }> {
  await ensureMobileApkLocal(tenantSlug);
  const st = mobileApkStat(tenantSlug);
  if (!st) return { ready: false, bytes: null, mtime_ms: null };
  return { ready: true, bytes: st.size, mtime_ms: st.mtimeMs };
}

export async function saveMobileApkStream(tenantSlug: string, stream: Readable): Promise<number> {
  const dir = join(UPLOAD_ROOT, tenantSlug);
  mkdirSync(dir, { recursive: true });
  const target = mobileApkFilePath(tenantSlug);
  const tmp = `${target}.upload`;
  let written = 0;
  await pipeline(
    stream,
    async function* (source) {
      for await (const chunk of source) {
        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        written += buf.length;
        if (written > MOBILE_APK_MAX_BYTES) {
          throw new Error("FILE_TOO_LARGE");
        }
        yield buf;
      }
    },
    createWriteStream(tmp)
  );
  renameSync(tmp, target);

  // Redeploydan keyin tiklash uchun ixtiyoriy object storage nusxa
  if (isRemoteObjectStorageEnabled()) {
    try {
      await storagePutFile(
        `mobile/${tenantSlug}`,
        "app-release.apk",
        target,
        "application/vnd.android.package-archive"
      );
    } catch {
      // Lokal saqlangan — download ishlaydi; remote xato jim
    }
  }

  return written;
}

export function openMobileApkReadStream(tenantSlug: string): ReturnType<typeof createReadStream> | null {
  const p = mobileApkFilePath(tenantSlug);
  if (!existsSync(p)) return null;
  return createReadStream(p);
}

/** Sync stream yo‘q bo‘lsa (remote-only) — bufferdan Readable. */
export async function openMobileApkReadable(tenantSlug: string): Promise<Readable | null> {
  if (await ensureMobileApkLocal(tenantSlug)) {
    return openMobileApkReadStream(tenantSlug);
  }
  if (!isRemoteObjectStorageEnabled()) return null;
  const buf = await storageReadBuffer(remoteApkKey(tenantSlug));
  if (!buf || buf.length < 1024) return null;
  return NodeReadable.from(buf);
}

export function buildMobileApkDownloadUrl(origin: string, tenantSlug: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/api/mobile/apk-download?slug=${encodeURIComponent(tenantSlug)}`;
}
