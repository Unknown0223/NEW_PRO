import { join } from "path";
import type { Readable } from "stream";
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "fs";
import { pipeline } from "stream/promises";
import { env } from "../../config/env";
import { isRemoteObjectStorageEnabled, storageOpenReadStream, storageSaveStreamToLocalThenUpload } from "../../lib/storage.service";

export const MOBILE_APK_MAX_BYTES = env.MULTIPART_APK_MAX_BYTES;

const UPLOAD_ROOT = join(process.cwd(), "uploads", "mobile");

export function mobileApkFilePath(tenantSlug: string): string {
  return join(UPLOAD_ROOT, tenantSlug, "app-release.apk");
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

export async function saveMobileApkStream(tenantSlug: string, stream: Readable): Promise<number> {
  if (isRemoteObjectStorageEnabled()) {
    const result = await storageSaveStreamToLocalThenUpload(
      `mobile/${tenantSlug}`,
      "app-release.apk",
      stream,
      "application/vnd.android.package-archive",
      MOBILE_APK_MAX_BYTES
    );
    return result.bytes;
  }

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
  return written;
}

export function openMobileApkReadStream(tenantSlug: string): ReturnType<typeof createReadStream> | null {
  if (isRemoteObjectStorageEnabled()) {
    return storageOpenReadStream(`mobile/${tenantSlug}/app-release.apk`);
  }
  const p = mobileApkFilePath(tenantSlug);
  if (!existsSync(p)) return null;
  return createReadStream(p);
}

export function buildMobileApkDownloadUrl(origin: string, tenantSlug: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/api/mobile/apk-download?slug=${encodeURIComponent(tenantSlug)}`;
}
