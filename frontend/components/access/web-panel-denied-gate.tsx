"use client";

import { isWebPanelDeniedRole } from "@/lib/access-web-users";
import { useAuthStore, useEffectiveRole } from "@/lib/auth-store";
import { useEffect, type ReactNode } from "react";

/**
 * Agent / dastavchik / inkasator veb-panelga kirmasligi kerak.
 * JWT allaqachon brauzerda bo‘lsa ham login sahifasiga qaytariladi.
 */
export function WebPanelDeniedGate({ children }: { children: ReactNode }) {
  const role = useEffectiveRole();
  const clearSession = useAuthStore((s) => s.clearSession);
  const denied = Boolean(role && isWebPanelDeniedRole(role));

  useEffect(() => {
    if (!denied) return;
    clearSession();
    if (typeof window === "undefined") return;
    if (window.location.pathname.startsWith("/login")) return;
    window.location.assign("/login?reason=web_access_denied");
  }, [denied, clearSession]);

  if (denied) {
    return <p className="p-6 text-sm text-muted-foreground">Перенаправление на вход…</p>;
  }
  return <>{children}</>;
}
