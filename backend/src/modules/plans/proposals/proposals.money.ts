/** So‘m (Decimal/number) ↔ tiyin (plans-proposal Money string). */

export function somToTiyin(som: number | string | null | undefined): string | null {
  if (som == null) return null;
  const n = typeof som === "number" ? som : Number(String(som).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return BigInt(Math.round(n * 100)).toString();
}

export function tiyinToSom(tiyin: string | null | undefined): number | null {
  if (tiyin == null || tiyin === "") return null;
  try {
    const v = BigInt(tiyin);
    return Number(v) / 100;
  } catch {
    return null;
  }
}

export function tiyinToSomString(tiyin: string | null | undefined): string | null {
  const n = tiyinToSom(tiyin);
  if (n == null) return null;
  return n.toFixed(2);
}
