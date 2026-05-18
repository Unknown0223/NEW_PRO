import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { clearAuthSessionFlagCookie, setAuthSessionFlagCookie } from "@/lib/auth-sync";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  tenantSlug: string | null;
  role: string | null;
  setSession: (payload: {
    accessToken: string;
    refreshToken: string;
    /** Agar berilmasa yoki bo‘sh bo‘lsa — JWT dan `tenantSlug` olinadi (refresh). */
    tenantSlug?: string | null;
    role?: string | null;
  }) => void;
  clearSession: () => void;
};

/** JWT access payload dan `role` (sessiya eski persist bo‘lsa tokendan ham olinadi). */
function decodeAccessTokenPayload(accessToken: string | null | undefined): { role?: unknown; tenantSlug?: unknown } | null {
  if (!accessToken) return null;
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1]!;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
    return JSON.parse(atob(padded)) as { role?: unknown; tenantSlug?: unknown };
  } catch {
    return null;
  }
}

export function decodeAccessTokenRole(accessToken: string | null | undefined): string | null {
  const json = decodeAccessTokenPayload(accessToken);
  return typeof json?.role === "string" ? json.role : null;
}

/** Backend JWT dagi `tenantSlug` — `/api/:slug/...` uchun (localStorage bilan ziddiyatni tuzatadi). */
export function decodeAccessTokenTenantSlug(accessToken: string | null | undefined): string | null {
  const json = decodeAccessTokenPayload(accessToken);
  const s = json?.tenantSlug;
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length > 0 ? t : null;
}

export function useEffectiveRole(): string | null {
  const accessToken = useAuthStore((s) => s.accessToken);
  const stored = useAuthStore((s) => s.role);
  const trimmed = typeof stored === "string" ? stored.trim() : "";
  if (trimmed.length > 0) {
    return trimmed;
  }
  return decodeAccessTokenRole(accessToken);
}

function setSessionCookie() {
  setAuthSessionFlagCookie();
}

function clearSessionCookie() {
  clearAuthSessionFlagCookie();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      tenantSlug: null,
      role: null,
      setSession: ({ accessToken, refreshToken, tenantSlug, role: roleIn }) => {
        setSessionCookie();
        const trimmedIn = roleIn != null && String(roleIn).trim() !== "" ? String(roleIn).trim() : null;
        const role = trimmedIn ?? decodeAccessTokenRole(accessToken);
        const slugFromJwt = decodeAccessTokenTenantSlug(accessToken);
        const fromArg = typeof tenantSlug === "string" ? tenantSlug.trim() : "";
        const slug = slugFromJwt ?? (fromArg.length > 0 ? fromArg : null);
        set({ accessToken, refreshToken, tenantSlug: slug, role });
      },
      clearSession: () => {
        clearSessionCookie();
        set({ accessToken: null, refreshToken: null, tenantSlug: null, role: null });
      }
    }),
    {
      name: "savdo-auth",
      merge: (persisted, current) => {
        const p = persisted as Partial<AuthState>;
        const next = { ...current, ...p } as AuthState;
        const jwtSlug = decodeAccessTokenTenantSlug(next.accessToken);
        if (jwtSlug) next.tenantSlug = jwtSlug;
        return next;
      }
    }
  )
);

/**
 * localStorage dan sessiya qayta yuklanguncha false.
 * SSR da `persist` bo‘lmasligi mumkin — faqat client `useEffect` da tekshiramiz.
 */
export function useAuthStoreHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const p = useAuthStore.persist;
    if (!p) {
      setHydrated(true);
      return;
    }
    setHydrated(p.hasHydrated());
    return p.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
