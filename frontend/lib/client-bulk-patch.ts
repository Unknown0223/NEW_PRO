/** PATCH /api/:slug/clients/bulk — umumiy yordamchilar */

export const BULK_PATCH_MAX_CLIENTS = 500;

export type ClientBulkPatchPayload = Record<string, unknown>;

export function chunkClientIds(ids: number[], max = BULK_PATCH_MAX_CLIENTS): number[][] {
  if (ids.length <= max) return [ids];
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += max) {
    out.push(ids.slice(i, i + max));
  }
  return out;
}
