"use client";

import {
  decodeAccessTokenTenantSlug,
  useAuthStore,
  useAuthStoreHydrated
} from "@/lib/auth-store";
import { readPersistedAuth } from "@/lib/persisted-auth";
import { apiBaseURL } from "@/lib/api";

/** Login paytida saqlangan tenant slug (marshrutlar `/api/${slug}/...` uchun). */
export function useTenant(): string {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const accessToken = useAuthStore((s) => s.accessToken);
  const fromStore = typeof tenantSlug === "string" ? tenantSlug.trim() : "";
  if (fromStore.length > 0) return fromStore;
  const fromJwt = decodeAccessTokenTenantSlug(accessToken);
  if (fromJwt) return fromJwt;
  const disk = readPersistedAuth().tenantSlug;
  return typeof disk === "string" ? disk.trim() : "";
}

/** localStorage sessiyasi yuklanguncha kutish + slug mavjudligi. */
export function useTenantReady(): { tenant: string; ready: boolean; hydrated: boolean } {
  const hydrated = useAuthStoreHydrated();
  const tenant = useTenant();
  return { tenant, hydrated, ready: hydrated && tenant.length > 0 };
}

export { useAuthStoreHydrated };

/**
 * Bearer + bir marta refresh (axios `api` bilan bir xil siyosat).
 * Faqat client komponentlarda.
 */
export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  if (typeof window === "undefined") {
    throw new Error("apiFetch is client-only");
  }
  const base = apiBaseURL || "";
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const buildHeaders = (): Headers => {
    const h = new Headers(init?.headers);
    const body = init?.body;
    if (body != null && typeof body === "string" && !h.has("Content-Type")) {
      h.set("Content-Type", "application/json");
    }
    const token = useAuthStore.getState().accessToken ?? readPersistedAuth().accessToken;
    if (token) h.set("Authorization", `Bearer ${token}`);
    return h;
  };

  const doFetch = () => fetch(url, { ...init, headers: buildHeaders() });

  let res = await doFetch();

  if (res.status === 401) {
    const store = useAuthStore.getState();
    const disk = readPersistedAuth();
    const refreshToken = store.refreshToken ?? disk.refreshToken;
    if (refreshToken) {
      try {
        const r = await fetch(`${base}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(refreshToken ? { refreshToken } : {})
        });
        if (r.ok) {
          const data = (await r.json()) as { accessToken: string; refreshToken: string };
          const prevSlug = store.tenantSlug ?? disk.tenantSlug;
          const slugFromJwt = decodeAccessTokenTenantSlug(data.accessToken);
          store.setSession({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            tenantSlug: slugFromJwt ?? prevSlug ?? undefined
          });
          res = await doFetch();
        }
      } catch {
        /* clear below if still 401 */
      }
    }
    if (res.status === 401) {
      useAuthStore.getState().clearSession();
    }
  }

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j?.error) detail = j.error;
    } catch {
      /* use text */
    }
    throw new Error(detail || res.statusText);
  }

  const ct = res.headers.get("content-type");
  if (ct?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as Promise<T>;
}
