import { api } from "@/lib/api";
import { qkDashboardMeta } from "@/lib/dashboard-shared-query-keys";
import { STALE } from "@/lib/query-stale";
import type { TerritoryNode } from "@/lib/territory-tree";
import { useQuery } from "@tanstack/react-query";

export type DashboardMetaResponse = {
  agents: Array<{ id: number; fio: string; code?: string | null }>;
  supervisors: Array<{ id: number; fio: string; code?: string | null }>;
  client_references: {
    categories?: string[];
    category_options?: Array<string | { value?: string; label?: string }>;
    zones?: string[];
    regions?: string[];
    cities?: string[];
    region_options?: Array<{ value: string; label?: string | null }>;
    city_options?: Array<{ value: string; label?: string | null }>;
    city_territory_hints?: Record<string, { city_label?: string | null }>;
  };
  product_categories: Array<{ id: number; name: string }>;
  profile_refs: {
    payment_method_entries?: Array<{ id: string; name: string; active?: boolean; code?: string | null }>;
    payment_types?: string[];
    trade_directions?: string[];
    territory_nodes?: TerritoryNode[];
  };
  product_sales_filter_options: Record<string, unknown>;
  territories: Array<{ id: number; name: string; code?: string | null }>;
  catalog_brands: Array<{ id: number; name: string }>;
  catalog_groups: Array<{ id: number; name: string }>;
  catalog_manufacturers: Array<{ id: number; name: string }>;
};

export async function fetchDashboardMeta(tenantSlug: string): Promise<DashboardMetaResponse> {
  const { data } = await api.get<DashboardMetaResponse>(`/api/${tenantSlug}/dashboard/meta`);
  return data;
}

export function useDashboardMeta(tenantSlug: string | null, enabled: boolean) {
  const q = useQuery({
    queryKey: qkDashboardMeta(tenantSlug),
    enabled: Boolean(tenantSlug) && enabled,
    staleTime: STALE.reference,
    queryFn: () => fetchDashboardMeta(tenantSlug!)
  });

  const meta = q.data;
  return {
    meta,
    metaLoading: q.isLoading,
    metaError: q.isError,
    agents: meta?.agents ?? [],
    supervisors: meta?.supervisors ?? [],
    clientRefs: meta?.client_references,
    profileRefs: meta?.profile_refs,
    reportFilters: meta?.product_sales_filter_options,
    productCategories: meta?.product_categories ?? [],
    territories: meta?.territories ?? [],
    catalogBrands: meta?.catalog_brands ?? [],
    catalogGroups: meta?.catalog_groups ?? [],
    catalogManufacturers: meta?.catalog_manufacturers ?? []
  };
}
