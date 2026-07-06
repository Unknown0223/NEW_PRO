"use client";

import { api } from "@/lib/api";
import type {
  GeoBoundary,
  GeoBoundaryOverlapConflict,
  GeoBoundaryUpsertBody
} from "@/lib/geo-boundaries-types";
import { STALE } from "@/lib/query-stale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

export type GeoBoundaryUpsertResult = {
  boundary: GeoBoundary;
  clipped: boolean;
  clients_assigned: number;
};

export type GeoBoundaryOverlapErrorPayload = {
  error: "GeoBoundaryOverlap";
  message: string;
  conflicts: GeoBoundaryOverlapConflict[];
};

export function isGeoBoundaryOverlapError(e: unknown): e is { response: { status: 409; data: GeoBoundaryOverlapErrorPayload } } {
  if (!isAxiosError(e) || e.response?.status !== 409) return false;
  const data = e.response.data as Partial<GeoBoundaryOverlapErrorPayload> | undefined;
  if (data?.error === "GeoBoundaryOverlap" && Array.isArray(data.conflicts) && data.conflicts.length > 0) {
    return true;
  }
  return Array.isArray(data?.conflicts) && data.conflicts.length > 0;
}

export function getGeoBoundaryOverlapConflicts(e: unknown): GeoBoundaryOverlapConflict[] | null {
  if (!isGeoBoundaryOverlapError(e)) return null;
  const data = (e as { response: { data: GeoBoundaryOverlapErrorPayload } }).response.data;
  return data.conflicts ?? null;
}

export function useGeoBoundaries(tenantSlug: string | null) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["geo-boundaries", tenantSlug],
    enabled: Boolean(tenantSlug),
    staleTime: STALE.list,
    queryFn: async () => {
      const { data } = await api.get<{ data: GeoBoundary[] }>(`/api/${tenantSlug}/geo-boundaries`);
      return data.data ?? [];
    }
  });

  const upsertMut = useMutation({
    mutationFn: async (body: GeoBoundaryUpsertBody) => {
      const { data } = await api.put<GeoBoundaryUpsertResult>(`/api/${tenantSlug}/geo-boundaries`, body);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["geo-boundaries", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug, "visit-planner"] });
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/${tenantSlug}/geo-boundaries/${id}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["geo-boundaries", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug, "visit-planner"] });
    }
  });

  const assignMut = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ updated: number }>(`/api/${tenantSlug}/geo-boundaries/${id}/assign-clients`);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      await qc.invalidateQueries({ queryKey: ["clients", tenantSlug, "visit-planner"] });
    }
  });

  return { q, upsertMut, deleteMut, assignMut };
}
