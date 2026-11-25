export type ShareCandidate = {
  userId: number;
  warehouseIds: number[];
};

export type SharePartnerRef = { userId: number };

/**
 * Empty partners → candidates sharing any of `ownWarehouseIds`.
 * Non-empty → only candidates whose userId is in partners (warehouse ignored).
 */
export function eligibleRecipients(
  ownWarehouseIds: number[],
  partners: SharePartnerRef[],
  candidates: ShareCandidate[]
): ShareCandidate[] {
  const own = new Set(ownWarehouseIds);
  if (partners.length === 0) {
    return candidates.filter((c) =>
      c.warehouseIds.some((w) => own.has(w))
    );
  }
  const allowed = new Set(partners.map((p) => p.userId));
  return candidates.filter((c) => allowed.has(c.userId));
}
