import type { QueryClient } from "@tanstack/react-query";

/** React Query key — app-shell / usePermissions / RouteAccessGate ulashadi. */
export function mePermissionsQueryKey(tenantSlug: string | null | undefined) {
  return ["me", "access-permissions", tenantSlug] as const;
}

/** Qisqa stale + polling: Access o‘zgarishi operator sessiyasida tez ko‘rinsin. */
export const ME_PERMISSIONS_STALE_MS = 15_000;
export const ME_PERMISSIONS_REFETCH_INTERVAL_MS = 20_000;

const BC_NAME = "salec:me-permissions";

export type MePermissionsBroadcast =
  | { type: "invalidate"; tenantSlug?: string | null; userId?: number | null; origin?: string }
  | { type: "ping" };

/** Shu tab BC echo sini o‘tkazib yuborish (invalidate + listener ikki marta urmasin). */
const BROADCAST_ORIGIN =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `salec-me-perm-${Math.random().toString(36).slice(2)}`;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(BC_NAME);
  } catch {
    return null;
  }
}

/** API / keshdan kelgan kalitlarni barqaror `string[]` ga aylantirish (structural sharing). */
export function normalizeMePermissionKeys(data: unknown): string[] {
  if (Array.isArray(data)) {
    return [...new Set(data.filter((x): x is string => typeof x === "string"))].sort();
  }
  if (data instanceof Set) {
    return [...data].filter((x): x is string => typeof x === "string").sort();
  }
  return [];
}

export function mePermissionKeySet(data: unknown): Set<string> {
  return new Set(normalizeMePermissionKeys(data));
}

/** Faqat birinchi yuklash — fon refetch UI ni «Загрузка» bilan yopmasin. */
export function isMePermissionsInitialLoad(q: {
  isPending: boolean;
  data: unknown;
}): boolean {
  return q.isPending && q.data === undefined;
}

/** Boshqa tab / shu brauzer: me-permissions ni yangilash. */
export function broadcastMePermissionsInvalidate(opts?: {
  tenantSlug?: string | null;
  userId?: number | null;
}) {
  const ch = getBroadcastChannel();
  if (!ch) return;
  try {
    const msg: MePermissionsBroadcast = {
      type: "invalidate",
      tenantSlug: opts?.tenantSlug ?? null,
      userId: opts?.userId ?? null,
      origin: BROADCAST_ORIGIN
    };
    ch.postMessage(msg);
  } finally {
    ch.close();
  }
}

/**
 * Faqat joriy foydalanuvchi `me-permissions` keshi.
 * Access workspace / user-detail / dimensions so‘rovlariga tegmaydi —
 * adminning ochiq modal/tanlovi saqlansin.
 */
export function invalidateMePermissionsQueries(
  qc: QueryClient,
  tenantSlug?: string | null,
  opts?: { userId?: number | null }
) {
  void qc.invalidateQueries({
    queryKey: tenantSlug ? mePermissionsQueryKey(tenantSlug) : ["me", "access-permissions"],
    refetchType: "active"
  });
  broadcastMePermissionsInvalidate({ tenantSlug, userId: opts?.userId });
}

/** QueryClient bo‘lmagan joylar (axios interceptor) uchun custom event. */
export function emitMePermissionsRefreshNeeded() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("salec:me-permissions-refresh"));
}

export function isMePermissionsBroadcastFromThisTab(msg: MePermissionsBroadcast): boolean {
  if (msg.type !== "invalidate") return false;
  return Boolean(msg.origin && msg.origin === BROADCAST_ORIGIN);
}

/**
 * JWT access payload dan `sub` (user id).
 * Access patch qilingan foydalanuvchi = joriy sessiya bo‘lsa darhol invalidate.
 */
export function decodeAccessTokenUserId(accessToken: string | null | undefined): number | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    const json = JSON.parse(atob(padded)) as { sub?: unknown };
    const n = typeof json.sub === "string" ? Number.parseInt(json.sub, 10) : Number(json.sub);
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}
