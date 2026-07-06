"use client";

import type { ReactNode } from "react";
import { usePermissions } from "@/lib/use-permissions";

type CanProps = {
  /** Bitta kalit. */
  permission?: string;
  /** Kalitlardan kamida bittasi. */
  anyOf?: string[];
  /** Barcha kalitlar. */
  allOf?: string[];
  /** Ruxsat bo'lmaganda ko'rsatiladigan muqobil (default: hech narsa). */
  fallback?: ReactNode;
  /** Kesh yuklanayotganda children ni ko'rsatish (default: false — yashiradi). */
  showWhileLoading?: boolean;
  children: ReactNode;
};

/**
 * Ruxsatga qarab UI elementini ko'rsatadi/yashiradi.
 *
 *   <Can permission="orders.zakaz.create"><Button>Создать</Button></Can>
 *   <Can anyOf={["clients.klient.update","clients.klient.delete"]}>…</Can>
 */
export function Can({ permission, anyOf, allOf, fallback = null, showWhileLoading = false, children }: CanProps) {
  const perms = usePermissions();
  if (perms.isLoading && !perms.isAdmin) return showWhileLoading ? <>{children}</> : <>{fallback}</>;

  let ok = true;
  if (permission) ok = ok && perms.has(permission);
  if (anyOf?.length) ok = ok && perms.hasAny(...anyOf);
  if (allOf?.length) ok = ok && perms.hasAll(...allOf);

  return <>{ok ? children : fallback}</>;
}
