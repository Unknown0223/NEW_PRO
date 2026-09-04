"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-28 w-28 text-2xl",
  xl: "h-36 w-36 text-3xl"
} as const;

type Size = keyof typeof SIZE_CLASS;

type Props = {
  tenantSlug: string;
  userId: number;
  /** Initials when photo missing / failed */
  initials?: string;
  alt?: string;
  size?: Size;
  className?: string;
  /** Skip image request (e.g. known no face) */
  hasPhoto?: boolean;
  ringColor?: string | null;
};

const blobUrlByKey = new Map<string, string>();
const failedKeys = new Set<string>();
const inflightByKey = new Map<string, Promise<string | null>>();

function cacheKey(tenantSlug: string, userId: number): string {
  return `${tenantSlug}:${userId}`;
}

/**
 * Upload/delete dan keyin yangi rasm ko‘rinsin.
 * Object URL cache ni tozalaydi.
 */
export function invalidateStaffFaceAvatarCache(tenantSlug: string, userId: number): void {
  const key = cacheKey(tenantSlug, userId);
  failedKeys.delete(key);
  const old = blobUrlByKey.get(key);
  if (old) {
    URL.revokeObjectURL(old);
    blobUrlByKey.delete(key);
  }
  inflightByKey.delete(key);
}

async function loadFaceBlobUrl(tenantSlug: string, userId: number): Promise<string | null> {
  const key = cacheKey(tenantSlug, userId);
  if (failedKeys.has(key)) return null;
  const cached = blobUrlByKey.get(key);
  if (cached) return cached;
  const inflight = inflightByKey.get(key);
  if (inflight) return inflight;

  const promise = (async () => {
    try {
      const res = await api.get<Blob>(`/api/${tenantSlug}/staff/users/${userId}/face-reference`, {
        responseType: "blob",
        headers: { Accept: "image/jpeg,image/png,image/webp,image/*" }
      });
      const blob = res.data;
      if (!(blob instanceof Blob) || blob.size === 0) {
        failedKeys.add(key);
        return null;
      }
      const type = (blob.type || "").toLowerCase();
      if (type.includes("application/json") || type.startsWith("text/")) {
        failedKeys.add(key);
        return null;
      }
      const url = URL.createObjectURL(blob);
      blobUrlByKey.set(key, url);
      return url;
    } catch {
      failedKeys.add(key);
      return null;
    } finally {
      inflightByKey.delete(key);
    }
  })();

  inflightByKey.set(key, promise);
  return promise;
}

/**
 * Dumaloq xodim rasmi — etalon face-reference (auth orqali blob);
 * yo‘q / xato bo‘lsa initials. `<img src="/api/...">` ishlatilmaydi —
 * brauzer Authorization yubormaydi va 401 flood + sekinlashish chiqadi.
 */
export function StaffFaceAvatar({
  tenantSlug,
  userId,
  initials = "?",
  alt = "",
  size = "sm",
  className,
  hasPhoto = true,
  ringColor
}: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(() => {
    if (!hasPhoto || userId <= 0) return null;
    return blobUrlByKey.get(cacheKey(tenantSlug, userId)) ?? null;
  });
  const [failed, setFailed] = useState(() => {
    if (!hasPhoto || userId <= 0) return true;
    return failedKeys.has(cacheKey(tenantSlug, userId));
  });

  useEffect(() => {
    if (!hasPhoto || userId <= 0) {
      setObjectUrl(null);
      setFailed(true);
      return;
    }

    const key = cacheKey(tenantSlug, userId);
    if (failedKeys.has(key)) {
      setObjectUrl(null);
      setFailed(true);
      return;
    }
    const cached = blobUrlByKey.get(key);
    if (cached) {
      setObjectUrl(cached);
      setFailed(false);
      return;
    }

    let cancelled = false;
    setFailed(false);
    void loadFaceBlobUrl(tenantSlug, userId).then((url) => {
      if (cancelled) return;
      if (url) {
        setObjectUrl(url);
        setFailed(false);
      } else {
        setObjectUrl(null);
        setFailed(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug, userId, hasPhoto]);

  const showImg = hasPhoto && userId > 0 && !failed && Boolean(objectUrl);

  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-slate-400 font-bold text-white shadow-sm",
        SIZE_CLASS[size],
        className
      )}
      style={ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : undefined}
      aria-hidden={!alt}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={objectUrl!}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => {
            failedKeys.add(cacheKey(tenantSlug, userId));
            setFailed(true);
          }}
        />
      ) : (
        <span className="select-none uppercase tracking-wide">{initials.slice(0, 2) || "?"}</span>
      )}
    </div>
  );
}
