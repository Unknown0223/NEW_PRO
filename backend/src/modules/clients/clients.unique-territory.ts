/** Hudud maydonlarini solishtirish (bo‘sh = «berilmagan»). */
export function normalizeTerritoryPart(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export type TerritoryParts = {
  region?: string | null;
  zone?: string | null;
  city?: string | null;
};

/** Ikki mijoz hududi bir xilmi (region/zone/city, case-insensitive). */
export function territoriesMatch(a: TerritoryParts, b: TerritoryParts): boolean {
  return (
    normalizeTerritoryPart(a.region) === normalizeTerritoryPart(b.region) &&
    normalizeTerritoryPart(a.zone) === normalizeTerritoryPart(b.zone) &&
    normalizeTerritoryPart(a.city) === normalizeTerritoryPart(b.city)
  );
}

/** Nom + hudud + (INN yoki PINFL) — bir xil mijoz identifikatori. */
export function isSameClientIdentity(
  a: TerritoryParts & {
    name?: string | null;
    inn?: string | null;
    client_pinfl?: string | null;
  },
  b: TerritoryParts & {
    name?: string | null;
    inn?: string | null;
    client_pinfl?: string | null;
  }
): boolean {
  const nameA = (a.name ?? "").trim().toLowerCase();
  const nameB = (b.name ?? "").trim().toLowerCase();
  if (!nameA || nameA !== nameB) return false;
  if (!territoriesMatch(a, b)) return false;

  const innA = (a.inn ?? "").trim().toLowerCase();
  const innB = (b.inn ?? "").trim().toLowerCase();
  const pinflA = (a.client_pinfl ?? "").trim().toLowerCase();
  const pinflB = (b.client_pinfl ?? "").trim().toLowerCase();

  if (innA && innB && innA === innB) return true;
  if (pinflA && pinflB && pinflA === pinflB) return true;
  // INN/PINFL yo‘q — hudud + nom yetarli
  if (!innA && !innB && !pinflA && !pinflB) return true;
  return false;
}

/** Prisma where: nom + berilgan hudud qismlari. */
export function territoryScopedNameWhere(parts: TerritoryParts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const region = (parts.region ?? "").trim();
  const zone = (parts.zone ?? "").trim();
  const city = (parts.city ?? "").trim();
  if (region) out.region = { equals: region, mode: "insensitive" };
  if (zone) out.zone = { equals: zone, mode: "insensitive" };
  if (city) out.city = { equals: city, mode: "insensitive" };
  return out;
}

export function hasAnyTerritory(parts: TerritoryParts): boolean {
  return Boolean(
    (parts.region ?? "").trim() || (parts.zone ?? "").trim() || (parts.city ?? "").trim()
  );
}
