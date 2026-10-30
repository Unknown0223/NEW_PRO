/**
 * Klient tahriri: agent/dastavchik tanlashni hudud bo‘yicha cheklash.
 * Hudud mos kelganda — faqat bog‘langan xodimlar (+ joriy tanlovlar).
 * Bo‘sh ro‘yxatga to‘liq fallback qilinmaydi (kaskad buzilmasin).
 */
export function filterStaffByTerritoryPickerContext<T extends { id: number }>(
  all: T[],
  ctx: { territory_matched: boolean; staff_ids: number[] } | null | undefined,
  currentSlotIds: number[]
): T[] {
  if (!ctx || !ctx.territory_matched) return all;
  const allow = new Set(ctx.staff_ids.filter((id) => Number.isFinite(id) && id > 0));
  for (const id of currentSlotIds) {
    if (Number.isFinite(id) && id > 0) allow.add(id);
  }
  if (allow.size === 0) return [];
  return all.filter((a) => allow.has(a.id));
}
