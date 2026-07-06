import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { STALE } from "@/lib/query-stale";
import {
  approverKeys,
  fetchApproverConfig,
  fetchApproverOptions,
  saveApproverConfig,
  type ApproverConfig,
  type ApproverOptions,
  type SaveApproverPayload
} from "./approvers-api";

export function useApproverOptions(tenantSlug: string | null, directionId: number | null) {
  return useQuery<ApproverOptions>({
    queryKey: approverKeys.options(tenantSlug, directionId),
    enabled: Boolean(tenantSlug) && directionId != null,
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: () => fetchApproverOptions(tenantSlug as string, directionId as number)
  });
}

/** Yo'nalishlar ro'yxati (supervayzerlar filtrisiz). */
export function useApproverDirections(tenantSlug: string | null) {
  return useQuery({
    queryKey: ["plans", "approvers", "directions", tenantSlug] as const,
    enabled: Boolean(tenantSlug),
    staleTime: STALE.reference,
    queryFn: async () => (await fetchApproverOptions(tenantSlug as string, null)).directions
  });
}

export function useApproverConfig(tenantSlug: string | null, directionId: number | null) {
  return useQuery<ApproverConfig>({
    queryKey: approverKeys.config(tenantSlug, directionId),
    enabled: Boolean(tenantSlug) && directionId != null,
    staleTime: STALE.detail,
    refetchOnMount: "always",
    queryFn: () => fetchApproverConfig(tenantSlug as string, directionId as number)
  });
}

export function useSaveApproverConfig(tenantSlug: string | null, directionId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveApproverPayload) =>
      saveApproverConfig(tenantSlug as string, directionId as number, payload),
    onSuccess: (data) => {
      qc.setQueryData(approverKeys.config(tenantSlug, directionId), data);
      void qc.invalidateQueries({ queryKey: ["plans", "approvers"] });
    }
  });
}
