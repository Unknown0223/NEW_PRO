/**
 * Bir xil API — turli dashboard sahifalarida React Query bitta keshni qayta ishlatadi.
 * `tenantSlug` null bo‘lsa ham kalit barqaror (so‘rov `enabled: false` bilan o‘chiriladi).
 */
import type { QueryClient } from "@tanstack/react-query";

export const qkDashboardAgentsActive = (tenantSlug: string | null) =>
  ["dashboard-shared", "agents", "is_active", tenantSlug ?? ""] as const;

export const qkDashboardSupervisorsActive = (tenantSlug: string | null) =>
  ["dashboard-shared", "supervisors", "is_active", tenantSlug ?? ""] as const;

export const qkDashboardClientReferences = (tenantSlug: string | null) =>
  ["dashboard-shared", "clients", "references", tenantSlug ?? ""] as const;

export const qkDashboardProductCategories = (tenantSlug: string | null) =>
  ["dashboard-shared", "product-categories", tenantSlug ?? ""] as const;

export const qkDashboardMeta = (tenantSlug: string | null) =>
  ["dashboard-shared", "meta", tenantSlug ?? ""] as const;

export const qkDashboardProfileRefs = (tenantSlug: string | null) =>
  ["dashboard-shared", "profile-refs", tenantSlug ?? ""] as const;

export const qkDashboardProductSalesFilters = (tenantSlug: string | null) =>
  ["dashboard-shared", "product-sales-filter-options", tenantSlug ?? ""] as const;

/** Zakaz otmena/status — dashboard savdo raqamlari darhol yangilansin. */
export function invalidateLiveDashboardQueries(qc: QueryClient, tenantSlug?: string | null) {
  void qc.invalidateQueries({ queryKey: ["dashboard-supervisor"] });
  void qc.invalidateQueries({ queryKey: ["dashboard-sales"] });
  void qc.invalidateQueries({ queryKey: ["dashboard-finance"] });
  void qc.invalidateQueries({ queryKey: ["sales-monitoring"] });
  void qc.invalidateQueries({ queryKey: ["dashboard-expeditors"] });
  if (tenantSlug) {
    void qc.invalidateQueries({ queryKey: ["dashboard-stats", tenantSlug] });
  }
}
