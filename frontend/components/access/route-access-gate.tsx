"use client";

import { AccessDeniedBanner } from "@/components/access/access-denied-banner";
import { findGatedNavItemForPath, isNavItemAllowed } from "@/lib/nav-route-access";
import { useEffectiveRole } from "@/lib/auth-store";
import { usePermissions } from "@/lib/use-permissions";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Deep-link himoyasi: yon panelda yashirilgan bo‘lim URL orqali ochilganda
 * aniq «нет доступа» ko‘rsatiladi (bo‘sh shell emas).
 *
 * Muhim: faqat *birinchi* permissions yuklashda children o‘rniga spinner —
 * poll/focus refetch ochiq modal/tanlovni yopmasin.
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
      <div className="flex flex-1 items-start justify-center p-6 sm:p-10">
        <AccessDeniedBanner
          title="Нет доступа / Ruxsat yo‘q"
          message={`Раздел «${gated.label}» недоступен для вашей роли или прав. / «${gated.label}» bo‘limi sizning rolingiz yoki ruxsatlaringiz uchun yopiq.`}
          secondaryHref="/access"
          secondaryLabel="Доступ / Kirish"
        />
      </div>
    );
  }

  return <>{children}</>;
}
