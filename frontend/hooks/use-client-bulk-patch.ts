"use client";

import { api } from "@/lib/api";
import {
  BULK_PATCH_MAX_CLIENTS,
  chunkClientIds,
  type ClientBulkPatchPayload
} from "@/lib/client-bulk-patch";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type ClientBulkPatchResult = {
  updated: number;
  failed: Array<{ id: number; error: string }>;
};

export { BULK_PATCH_MAX_CLIENTS };

export function useClientBulkPatch(tenantSlug: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientIds,
      patch
    }: {
      clientIds: number[];
      patch: ClientBulkPatchPayload;
    }) => {
      if (!tenantSlug) throw new Error("NO_TENANT");
      const ids = [...new Set(clientIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0))];
      if (ids.length === 0) throw new Error("NO_CLIENTS");

      const chunks = chunkClientIds(ids);
      let updated = 0;
      const failed: ClientBulkPatchResult["failed"] = [];

      for (const chunk of chunks) {
        const { data } = await api.patch<ClientBulkPatchResult>(`/api/${tenantSlug}/clients/bulk`, {
          client_ids: chunk,
          patch
        });
        updated += data.updated;
        failed.push(...data.failed);
      }

      return { updated, failed };
    },
    onSuccess: async () => {
      if (tenantSlug) {
        await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      }
    }
  });
}

export function useClientBulkActive(tenantSlug: string | null) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ clientIds, is_active }: { clientIds: number[]; is_active: boolean }) => {
      if (!tenantSlug) throw new Error("NO_TENANT");
      const ids = [...new Set(clientIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0))];
      if (ids.length === 0) throw new Error("NO_CLIENTS");

      let updated = 0;
      for (const chunk of chunkClientIds(ids)) {
        const { data } = await api.patch<{ updated: number }>(`/api/${tenantSlug}/clients/bulk-active`, {
          client_ids: chunk,
          is_active
        });
        updated += data.updated;
      }
      return { updated };
    },
    onSuccess: async () => {
      if (tenantSlug) {
        await qc.invalidateQueries({ queryKey: ["clients", tenantSlug] });
      }
    }
  });
}
