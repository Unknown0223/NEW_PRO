/** PATCH /api/:slug/clients/bulk — umumiy yordamchilar */

import { api } from "@/lib/api";

export const BULK_PATCH_MAX_CLIENTS = 500;

export type ClientBulkPatchPayload = Record<string, unknown>;

export type ClientBulkPatchResult = {
  updated: number;
  failed: Array<{ id: number; error: string }>;
};

export type ClientBulkItem = {
  client_id: number;
  patch: ClientBulkPatchPayload;
};

export function chunkClientIds(ids: number[], max = BULK_PATCH_MAX_CLIENTS): number[][] {
  if (ids.length <= max) return [ids];
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += max) {
    out.push(ids.slice(i, i + max));
  }
  return out;
}

export function chunkBulkItems<T>(items: T[], max = BULK_PATCH_MAX_CLIENTS): T[][] {
  if (items.length <= max) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += max) {
    out.push(items.slice(i, i + max));
  }
  return out;
}

/** Har klientga alohida patch — bitta (yoki chunk) HTTP so‘rov. */
export async function patchClientsBulkItems(
  tenantSlug: string,
  items: ClientBulkItem[]
): Promise<ClientBulkPatchResult> {
  const byId = new Map<number, ClientBulkItem>();
  for (const item of items) {
    const id = Math.floor(Number(item.client_id));
    if (!Number.isFinite(id) || id < 1) continue;
    byId.set(id, { client_id: id, patch: item.patch });
  }
  const unique = [...byId.values()];
  if (unique.length === 0) return { updated: 0, failed: [] };

  let updated = 0;
  const failed: ClientBulkPatchResult["failed"] = [];
  for (const chunk of chunkBulkItems(unique)) {
    const { data } = await api.patch<ClientBulkPatchResult>(`/api/${tenantSlug}/clients/bulk-items`, {
      items: chunk
    });
    updated += data.updated;
    failed.push(...(data.failed ?? []));
  }
  return { updated, failed };
}
