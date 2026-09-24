import { uniquePositiveIds } from "./access-staff-scope";

/** Slot + Dostup filial kodlarini birlashtirish. */
export function mergeBranchCodesForScope(
  fromLinks: string[],
  fromSlot: { branch_code?: string | null; branch_codes?: string[] | null } | null | undefined
): string[] {
  const out = new Set<string>();
  for (const c of fromLinks) {
    const t = c.trim();
    if (t) out.add(t);
  }
  if (fromSlot) {
    const primary = fromSlot.branch_code?.trim();
    if (primary) out.add(primary);
    for (const c of fromSlot.branch_codes ?? []) {
      const t = String(c).trim();
      if (t) out.add(t);
    }
  }
  return [...out];
}

/** Slot territories + user.territory — string match uchun terminlar. */
const GENERIC_TERRITORY_TOKENS = new Set(
  [
    "viloyati",
    "viloyat",
    "область",
    "oblast",
    "region",
    "zona",
    "zone",
    "shahar",
    "город",
    "city",
    "tuman",
    "district",
    "south",
    "west",
    "east",
    "north",
    "south west",
    "south-west",
    "north west",
    "north-east"
  ].map((s) => s.toLowerCase())
);

/**
 * Geo/hodim qidiruvi uchun terminlar.
 * «Zona / Oblast / Shahar» da birinchi segment (zona) QO‘SHILMAYDI —
 * aks holda South West → Andijon+Xorazm hammasi chiqadi.
 */
export function mergeTerritoryTermsForScope(
  userTerritory: string | null | undefined,
  fromSlot: { territory?: string | null; territories?: string[] | null } | null | undefined
): string[] {
  const out = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const t = (raw ?? "").trim();
    if (!t) return;
    const parts = t
      .split(/[|/·•]/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2 && !GENERIC_TERRITORY_TOKENS.has(p.toLowerCase()));

    if (parts.length >= 2) {
      // To‘liq yo‘l — aniq match; zona (parts[0]) geo qidiruvga kirmaydi
      out.add(t);
      for (const part of parts.slice(1)) {
        out.add(part);
        const words = part.split(/\s+/).map((w) => w.trim()).filter(Boolean);
        if (words.length >= 2) {
          const head = words[0]!;
          if (head.length >= 3 && !GENERIC_TERRITORY_TOKENS.has(head.toLowerCase())) {
            out.add(head);
          }
        }
      }
      return;
    }

    if (parts.length === 1) {
      out.add(parts[0]!);
      return;
    }
    if (!GENERIC_TERRITORY_TOKENS.has(t.toLowerCase())) out.add(t);
  };
  add(userTerritory);
  if (fromSlot) {
    add(fromSlot.territory);
    for (const t of fromSlot.territories ?? []) add(String(t));
  }
  return [...out];
}

export function mergeWarehouseIdsForScope(
  fromLinks: number[],
  fromSlot: { warehouse_id?: number | null; warehouse_ids?: number[] | null } | null | undefined
): number[] {
  const ids = [...fromLinks];
  if (fromSlot) {
    if (fromSlot.warehouse_id != null) ids.push(fromSlot.warehouse_id);
    for (const id of fromSlot.warehouse_ids ?? []) ids.push(id);
  }
  return uniquePositiveIds(ids);
}

export function mergeCashDeskIdsForScope(
  fromLinks: number[],
  fromSlot: { cash_desk_id?: number | null; cash_desk_ids?: number[] | null } | null | undefined
): number[] {
  const ids = [...fromLinks];
  if (fromSlot) {
    if (fromSlot.cash_desk_id != null) ids.push(fromSlot.cash_desk_id);
    for (const id of fromSlot.cash_desk_ids ?? []) ids.push(id);
  }
  return uniquePositiveIds(ids);
}

/** Geo manbalar (hudud + filial) — birlashma; hodim kesishmasi alohida. */
export function mergeGeoStaffIds(...groups: number[][]): number[] {
  return uniquePositiveIds(groups.flat());
}
