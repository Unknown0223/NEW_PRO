"use client";

import { AccessDeniedBanner } from "@/components/access/access-denied-banner";
import { findGatedNavItemForPath, isNavItemAllowed } from "@/lib/nav-route-access";
import { useEffectiveRole } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Deep-link himoyasi: yon panelda yashirilgan bo‘lim URL orqali ochilganda
 * to‘liq 403 ErrorPage (bo‘sh shell emas).
 */
export function RouteAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const role = useEffectiveRole();
  const perms = usePermissions();
  const gated = findGatedNavItemForPath(pathname);

  if (!gated) return <>{children}</>;
  if (perms.isLoading && role !== "admin") {
    return <p className="p-6 text-sm text-muted-foreground">Проверка доступа…</p>;
  }

  const allowed = isNavItemAllowed(gated, role, perms.keys);
  if (!allowed) {
    return (
      <AccessDeniedBanner
        resource={gated.label}
        message={`Раздел «${gated.label}» недоступен для вашей роли или прав.`}
        secondaryHref="/access"
        secondaryLabel="Доступ"
      />
    );
  }

  return <>{children}</>;
}
