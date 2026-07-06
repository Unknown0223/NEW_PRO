import type { AccessPatchBodyInput } from "./access-user-patch.apply";

export type BulkAccessPatchItem = { user_id: number } & AccessPatchBodyInput;

function scopeTouched(body: AccessPatchBodyInput): boolean {
  return (
    body.branch_codes !== undefined ||
    body.warehouse_ids !== undefined ||
    body.warehouse_delegate !== undefined ||
    body.cash_desk_ids !== undefined ||
    body.payment_methods !== undefined ||
    body.territory_ids !== undefined ||
    body.trade_direction_ids !== undefined
  );
}

function onlyWarehouseDelegatePatch(body: AccessPatchBodyInput): boolean {
  if (!body.warehouse_delegate) return false;
  if (
    body.branch_codes !== undefined ||
    body.warehouse_ids !== undefined ||
    body.cash_desk_ids !== undefined ||
    body.payment_methods !== undefined ||
    body.territory_ids !== undefined ||
    body.trade_direction_ids !== undefined
  )
    return false;
  if (
    body.permissions !== undefined ||
    body.denied_permissions !== undefined ||
    Boolean(body.remove_permission_keys?.length) ||
    body.merge_permissions != null ||
    Boolean(body.role?.trim()) ||
    body.is_active != null
  )
    return false;
  return true;
}

/** Barcha qatorlarda bir xil `warehouse_delegate` — bitta `updateMany`. */
export function tryUniformWarehouseDelegateBulk(
  slice: BulkAccessPatchItem[]
): { userIds: number[]; warehouse_id: number; delegate: boolean } | null {
  if (slice.length === 0) return null;
  const first = slice[0]!;
  if (!onlyWarehouseDelegatePatch(first)) return null;
  const wid = first.warehouse_delegate!.warehouse_id;
  const del = first.warehouse_delegate!.delegate;
  if (!Number.isInteger(wid) || wid < 1) return null;
  for (const it of slice) {
    if (!onlyWarehouseDelegatePatch(it)) return null;
    const w = it.warehouse_delegate!.warehouse_id;
    const d = it.warehouse_delegate!.delegate;
    if (w !== wid || d !== del) return null;
  }
  return { userIds: slice.map((s) => s.user_id), warehouse_id: wid, delegate: del };
}

function stableSortedStrings(xs: string[]): string[] {
  return [...new Set(xs.map((x) => String(x).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Matrix / «всем видимым» — barcha qatorlarda bir xil merge (allow/deny to‘plamlari).
 * Bunday holda permission `upsert` ni N marta emas, batch `deleteMany`+`createMany` bilan almashtiramiz.
 */
export function tryUniformMergeBulk(slice: BulkAccessPatchItem[]): { userIds: number[]; allow: string[]; deny: string[] } | null {
  if (slice.length === 0) return null;
  const first = slice[0]!;
  if (first.merge_permissions !== true) return null;
  if (first.permissions === undefined && first.denied_permissions === undefined) return null;
  if (first.remove_permission_keys?.length) return null;
  if (scopeTouched(first)) return null;

  const allow0 = stableSortedStrings(first.permissions ?? []);
  const deny0 = stableSortedStrings(first.denied_permissions ?? []);

  for (const it of slice) {
    if (it.merge_permissions !== true) return null;
    if (it.permissions === undefined && it.denied_permissions === undefined) return null;
    if (it.remove_permission_keys?.length) return null;
    if (scopeTouched(it)) return null;
    const a = stableSortedStrings(it.permissions ?? []);
    const d = stableSortedStrings(it.denied_permissions ?? []);
    if (a.length !== allow0.length || d.length !== deny0.length) return null;
    for (let i = 0; i < a.length; i++) if (a[i] !== allow0[i]) return null;
    for (let i = 0; i < d.length; i++) if (d[i] !== deny0[i]) return null;
  }
  return { userIds: slice.map((s) => s.user_id), allow: allow0, deny: deny0 };
}

/** Faqat `remove_permission_keys` (detach) — bir xil kalitlar ro‘yxati. */
export function tryUniformRemoveBulk(slice: BulkAccessPatchItem[]): { userIds: number[]; keys: string[] } | null {
  if (slice.length === 0) return null;
  const first = slice[0]!;
  if (!first.remove_permission_keys?.length) return null;
  if (first.permissions !== undefined || first.denied_permissions !== undefined) return null;
  if (first.merge_permissions != null) return null;
  if (scopeTouched(first)) return null;

  const keys0 = stableSortedStrings(first.remove_permission_keys);

  for (const it of slice) {
    if (!it.remove_permission_keys?.length) return null;
    if (it.permissions !== undefined || it.denied_permissions !== undefined) return null;
    if (it.merge_permissions != null) return null;
    if (scopeTouched(it)) return null;
    const k = stableSortedStrings(it.remove_permission_keys);
    if (k.length !== keys0.length) return null;
    for (let i = 0; i < k.length; i++) if (k[i] !== keys0[i]) return null;
  }
  return { userIds: slice.map((s) => s.user_id), keys: keys0 };
}

export function collectPermissionKeysFromBulkSlice(slice: BulkAccessPatchItem[]): string[] {
  const s = new Set<string>();
  for (const it of slice) {
    for (const x of it.remove_permission_keys ?? []) {
      const t = String(x).trim();
      if (t) s.add(t);
    }
    for (const x of it.permissions ?? []) {
      const t = String(x).trim();
      if (t) s.add(t);
    }
    for (const x of it.denied_permissions ?? []) {
      const t = String(x).trim();
      if (t) s.add(t);
    }
  }
  return [...s];
}

export function collectTerritoryIdsFromBulkSlice(slice: BulkAccessPatchItem[]): number[] {
  const s = new Set<number>();
  for (const it of slice) {
    if (it.territory_ids === undefined) continue;
    for (const id of it.territory_ids) {
      const n = Number(id);
      if (Number.isInteger(n) && n > 0) s.add(n);
    }
  }
  return [...s];
}
