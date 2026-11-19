"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AccessDeniedBanner } from "@/components/access/access-denied-banner";
import { useAuthStore, useAuthStoreHydrated } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";

export function TaklifiyRejaGate({ children }: { children: ReactNode }) {
  const tenantSlug = useAuthStore((s) => s.tenantSlug);
  const hydrated = useAuthStoreHydrated();
  const perms = usePermissions();

  if (!hydrated) return <p className="p-6 text-sm text-muted-foreground">Загрузка сессии…</p>;
  if (!tenantSlug) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Сессия не найдена.{" "}
        <Link href="/login" className="text-primary underline">
          Войти
        </Link>
      </p>
    );
  }
  if (!perms.isLoading && !perms.has("plans.taklifiy_reja.view")) {
    return <AccessDeniedBanner resource="Предлагаемый план" />;
  }
  return <>{children}</>;
}
