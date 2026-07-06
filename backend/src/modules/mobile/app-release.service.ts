import { prisma } from "../../config/database";
import { MOBILE_FIELD_ROLE_NAMES } from "../auth/app-access.service";
import { asRecord } from "../tenant-settings/tenant-settings.shared";
import { buildMobileApkDownloadUrl, mobileApkExists } from "./mobile-apk.service";

export type MobileAppReleasePolicy = {
  min_version: string | null;
  latest_version: string | null;
  force_update: boolean;
  download_url: string | null;
  store_url_android: string | null;
  store_url_ios: string | null;
  release_notes: string | null;
};

export type AppUpdateBlock = {
  required: boolean;
  optional: boolean;
  current_version: string;
  min_version: string | null;
  latest_version: string | null;
  /** Brauzer / do‘kon (Play/App Store) uchun asosiy havola. */
  url: string | null;
  /** Serverdagi APK — ilova ichida o‘rnatish (kesh saqlanadi). */
  apk_url: string | null;
  store_url_android: string | null;
  store_url_ios: string | null;
  notes: string | null;
};

export type OutdatedMobileUserRow = {
  id: number;
  name: string;
  login: string;
  role: string;
  apk_version: string | null;
  device_name: string | null;
  last_sync_at: string | null;
};

const DEFAULT_POLICY: MobileAppReleasePolicy = {
  min_version: null,
  latest_version: null,
  force_update: false,
  download_url: null,
  store_url_android: null,
  store_url_ios: null,
  release_notes: null
};

export function normalizeVersion(v: string | null | undefined): string | null {
  const t = v?.trim();
  if (!t) return null;
  return t.slice(0, 64);
}

export function compareSemver(a: string, b: string): number {
  const parseParts = (v: string) =>
    v
      .replace(/^v/i, "")
      .split(/[+-]/)[0]
      .split(".")
      .map((x) => parseInt(x, 10) || 0);
  const pa = parseParts(a);
  const pb = parseParts(b);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export function normalizeMobileAppReleasePolicy(raw: unknown): MobileAppReleasePolicy {
  const r = asRecord(raw);
  return {
    min_version: normalizeVersion(r.min_version as string),
    latest_version: normalizeVersion(r.latest_version as string),
    force_update: r.force_update === true,
    download_url:
      typeof r.download_url === "string" && r.download_url.trim()
        ? r.download_url.trim().slice(0, 4000)
        : null,
    store_url_android:
      typeof r.store_url_android === "string" && r.store_url_android.trim()
        ? r.store_url_android.trim().slice(0, 4000)
        : null,
    store_url_ios:
      typeof r.store_url_ios === "string" && r.store_url_ios.trim()
        ? r.store_url_ios.trim().slice(0, 4000)
        : null,
    release_notes:
      typeof r.release_notes === "string" ? r.release_notes.trim().slice(0, 8000) || null : null
  };
}

export async function getMobileAppReleasePolicy(tenantId: number): Promise<MobileAppReleasePolicy> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) return DEFAULT_POLICY;
  const st = asRecord(row.settings);
  return normalizeMobileAppReleasePolicy(st.mobile_app_release);
}

export async function patchMobileAppReleasePolicy(
  tenantId: number,
  patch: Partial<MobileAppReleasePolicy>
): Promise<MobileAppReleasePolicy> {
  const row = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true }
  });
  if (!row) throw new Error("NOT_FOUND");

  const st = asRecord(row.settings);
  const prev = normalizeMobileAppReleasePolicy(st.mobile_app_release);
  const next: MobileAppReleasePolicy = {
    min_version: patch.min_version !== undefined ? normalizeVersion(patch.min_version) : prev.min_version,
    latest_version:
      patch.latest_version !== undefined ? normalizeVersion(patch.latest_version) : prev.latest_version,
    force_update: patch.force_update !== undefined ? patch.force_update === true : prev.force_update,
    download_url:
      patch.download_url !== undefined
        ? patch.download_url?.trim().slice(0, 4000) || null
        : prev.download_url,
    store_url_android:
      patch.store_url_android !== undefined
        ? patch.store_url_android?.trim().slice(0, 4000) || null
        : prev.store_url_android,
    store_url_ios:
      patch.store_url_ios !== undefined
        ? patch.store_url_ios?.trim().slice(0, 4000) || null
        : prev.store_url_ios,
    release_notes:
      patch.release_notes !== undefined
        ? patch.release_notes?.trim().slice(0, 8000) || null
        : prev.release_notes
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      settings: {
        ...st,
        mobile_app_release: next
      } as object
    }
  });

  return next;
}

export function resolveAppUpdateBlock(
  currentVersion: string,
  policy: MobileAppReleasePolicy,
  platform: "android" | "ios" = "android"
): AppUpdateBlock {
  const cur = normalizeVersion(currentVersion) ?? "0.0.0";
  const min = policy.min_version;
  const latest = policy.latest_version;

  const belowMin = min ? compareSemver(cur, min) < 0 : false;
  const belowLatest = latest ? compareSemver(cur, latest) < 0 : false;

  const required = belowMin || (policy.force_update && belowLatest);
  const optional = belowLatest && !required;

  const apkUrl = policy.download_url?.trim() || null;
  const storeUrl = platform === "ios" ? policy.store_url_ios : policy.store_url_android;
  const url = storeUrl?.trim() || apkUrl;

  return {
    required,
    optional,
    current_version: cur,
    min_version: min,
    latest_version: latest,
    url,
    apk_url: apkUrl,
    store_url_android: policy.store_url_android,
    store_url_ios: policy.store_url_ios,
    notes: policy.release_notes
  };
}

export function resolveApkDownloadUrl(
  policy: MobileAppReleasePolicy,
  tenantSlug: string,
  origin: string
): string | null {
  if (policy.download_url?.trim()) return policy.download_url.trim();
  if (mobileApkExists(tenantSlug)) return buildMobileApkDownloadUrl(origin, tenantSlug);
  return null;
}

/** APK serverda yuklangan bo‘lsa, `apk_url` va kerak bo‘lsa `url` ni to‘ldiradi. */
export function enrichAppUpdateBlockUrl(
  block: AppUpdateBlock,
  policy: MobileAppReleasePolicy,
  tenantSlug: string,
  origin: string
): AppUpdateBlock {
  const apkUrl = resolveApkDownloadUrl(policy, tenantSlug, origin);
  const url = block.url?.trim() || apkUrl;
  return { ...block, url, apk_url: apkUrl };
}

export function resolveRequestOrigin(headers: {
  "x-forwarded-proto"?: string | string[];
  "x-forwarded-host"?: string | string[];
  host?: string | string[];
}): string {
  const protoHeader = headers["x-forwarded-proto"];
  const proto = typeof protoHeader === "string" ? protoHeader.split(",")[0]?.trim() : "http";
  const hostHeader = headers["x-forwarded-host"] ?? headers.host;
  const host =
    typeof hostHeader === "string" ? hostHeader.split(",")[0]?.trim() : "127.0.0.1:18080";
  return `${proto || "http"}://${host}`;
}

export async function resolveAppUpdateForTenant(
  tenantId: number,
  currentVersion: string | null | undefined,
  platform: "android" | "ios" = "android",
  opts?: { origin?: string | null; tenantSlug?: string }
): Promise<AppUpdateBlock | null> {
  const policy = await getMobileAppReleasePolicy(tenantId);
  const cur = normalizeVersion(currentVersion) ?? "0.0.0";
  let block = resolveAppUpdateBlock(cur, policy, platform);
  if (!block.required && !block.optional) return null;

  const slug =
    opts?.tenantSlug ??
    (
      await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { slug: true }
      })
    )?.slug;
  if (slug && opts?.origin) {
    block = enrichAppUpdateBlockUrl(block, policy, slug, opts.origin);
  }
  return block;
}

export function isApkOutdated(
  apkVersion: string | null | undefined,
  policy: MobileAppReleasePolicy
): boolean {
  const cur = normalizeVersion(apkVersion);
  if (!cur) return policy.min_version != null || policy.latest_version != null;
  if (policy.min_version && compareSemver(cur, policy.min_version) < 0) return true;
  if (policy.latest_version && compareSemver(cur, policy.latest_version) < 0) return true;
  return false;
}

export async function listOutdatedMobileUsers(tenantId: number): Promise<OutdatedMobileUserRow[]> {
  const policy = await getMobileAppReleasePolicy(tenantId);
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: { in: [...MOBILE_FIELD_ROLE_NAMES] },
      app_access: true
    },
    select: {
      id: true,
      name: true,
      login: true,
      role: true,
      apk_version: true,
      device_name: true,
      last_sync_at: true
    },
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });

  return users
    .filter((u) => isApkOutdated(u.apk_version, policy))
    .map((u) => ({
      id: u.id,
      name: u.name,
      login: u.login,
      role: u.role,
      apk_version: u.apk_version,
      device_name: u.device_name,
      last_sync_at: u.last_sync_at?.toISOString() ?? null
    }));
}
