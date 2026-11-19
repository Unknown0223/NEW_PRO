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

/** Filial nomini solishtirish kaliti: «Farg'ona» = «Fargona» = «FARG`ONA». */
export function normalizeBranchKey(raw: string | null | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/['`ʻʼ‘’´"]/g, "")
    .replace(/[\s_-]+/g, "")
    .trim();
}

/** `branch` maydonida bir nechta filial bo‘lishi mumkin («A, B»). */
export function branchFieldMatchesKeys(raw: string | null | undefined, keys: ReadonlySet<string>): boolean {
  if (!raw || keys.size === 0) return false;
  return raw.split(/[,;|]/).some((part) => {
    const k = normalizeBranchKey(part);
    return k.length > 0 && keys.has(k);
  });
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

/**
 * Dostup linklari asosiy chegara.
 * Slot kengaytirishi mumkin, lekin linklar bo‘lsa — faqat kesishma (butun katalogni slotga
 * yozib qo‘yish Navoiy hodimiga Namangan kassa/skladini ochib yubormasin).
 */
export function mergeWarehouseIdsForScope(
  fromLinks: number[],
  fromSlot: { warehouse_id?: number | null; warehouse_ids?: number[] | null } | null | undefined
): number[] {
  const linkIds = uniquePositiveIds(fromLinks);
  const slotIds: number[] = [];
  if (fromSlot) {
    if (fromSlot.warehouse_id != null) slotIds.push(fromSlot.warehouse_id);
    for (const id of fromSlot.warehouse_ids ?? []) slotIds.push(id);
  }
  const slot = uniquePositiveIds(slotIds);
  if (linkIds.length > 0 && slot.length > 0) {
    const allow = new Set(linkIds);
    return slot.filter((id) => allow.has(id));
  }
  if (linkIds.length > 0) return linkIds;
  return slot;
}

export function mergeCashDeskIdsForScope(
  fromLinks: number[],
  fromSlot: { cash_desk_id?: number | null; cash_desk_ids?: number[] | null } | null | undefined
): number[] {
  const linkIds = uniquePositiveIds(fromLinks);
  const slotIds: number[] = [];
  if (fromSlot) {
    if (fromSlot.cash_desk_id != null) slotIds.push(fromSlot.cash_desk_id);
    for (const id of fromSlot.cash_desk_ids ?? []) slotIds.push(id);
  }
  const slot = uniquePositiveIds(slotIds);
  if (linkIds.length > 0 && slot.length > 0) {
    const allow = new Set(linkIds);
    return slot.filter((id) => allow.has(id));
  }
  if (linkIds.length > 0) return linkIds;
  return slot;
}

/** Geo manbalar (hudud + filial) — birlashma; hodim kesishmasi alohida. */
export function mergeGeoStaffIds(...groups: number[][]): number[] {
  return uniquePositiveIds(groups.flat());
}
