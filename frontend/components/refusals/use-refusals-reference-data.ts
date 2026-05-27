"use client";

import { api } from "@/lib/api";
import { activeRefSelectOptions } from "@/lib/profile-ref-entries";
import { STALE } from "@/lib/query-stale";
import {
  buildZoneRegionCityCascadeOptions,
  type ClientRefsTerritoryBundle
} from "@/lib/territory-client-filters";
import type { TerritoryNode } from "@/lib/territory-tree";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

export function useRefusalsReferenceData(tenantSlug: string | null) {
  const agentsQ = useQuery({
    queryKey: ["agents", tenantSlug, "refusals-filters"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data: body } = await api.get<{ data: { id: number; fio: string; code: string | null }[] }>(
        `/api/${tenantSlug}/agents`
      );
      return body.data ?? [];
    }
  });

  const profileRefsQ = useQuery({
    queryKey: ["settings", "profile", tenantSlug, "refusals-filters"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.profile,
    queryFn: async () => {
      const { data } = await api.get<{
        references?: {
          client_categories?: string[];
          refusal_reason_entries?: unknown;
          territory_nodes?: TerritoryNode[];
        };
      }>(`/api/${tenantSlug}/settings/profile`);
      return data.references ?? {};
    }
  });

  const clientRefsQ = useQuery({
    queryKey: ["clients-references", tenantSlug, "refusals-filters"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<ClientRefsTerritoryBundle>(`/api/${tenantSlug}/clients/references`);
      return data;
    }
  });

  /** Profilda sabablar bo‘lmasa — mavjud otkazlar ro‘yxatidan (backend fallback) */
  const refusalReasonsFallbackQ = useQuery({
    queryKey: ["refusals-filter-options", tenantSlug, "reasons-fallback"],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => {
      const { data } = await api.get<{ data: { reasons: Array<{ value: string; label: string }> } }>(
        `/api/${tenantSlug}/refusals/filter-options`
      );
      return data.data.reasons ?? [];
    }
  });

  const clientCategoryFilterOpts = useMemo(() => {
    const raw = profileRefsQ.data?.client_categories;
    if (!Array.isArray(raw) || raw.length === 0) return [];
    const seen = new Set<string>();
    const out: { value: string; label: string }[] = [];
    for (const x of raw) {
      const t = String(x).trim().slice(0, 128);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push({ value: t, label: t });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [profileRefsQ.data?.client_categories]);

  const refusalReasonFilterOpts = useMemo(() => {
    const fromProfile = activeRefSelectOptions(profileRefsQ.data?.refusal_reason_entries);
    if (fromProfile.length > 0) return fromProfile;
    return refusalReasonsFallbackQ.data ?? [];
  }, [profileRefsQ.data?.refusal_reason_entries, refusalReasonsFallbackQ.data]);

  const territoryNodes = profileRefsQ.data?.territory_nodes;

  const buildTerritoryCascade = useCallback(
    (current: { zone: string; region: string; city: string }) =>
      buildZoneRegionCityCascadeOptions(clientRefsQ.data, undefined, territoryNodes, current),
    [clientRefsQ.data, territoryNodes]
  );

  const isLoading = agentsQ.isLoading || profileRefsQ.isLoading || clientRefsQ.isLoading;
  const isError = agentsQ.isError || profileRefsQ.isError || clientRefsQ.isError;

  return {
    agentsQ,
    profileRefsQ,
    clientRefsQ,
    clientCategoryFilterOpts,
    refusalReasonFilterOpts,
    buildTerritoryCascade,
    isLoading,
    isError
  };
}
