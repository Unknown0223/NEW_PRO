/** Territory string helpers — mirror modulidan circular import oldini olish. */

export function parseUserTerritoryPartsFromHelpers(raw: string | null | undefined): {
  zone: string | null;
  oblast: string | null;
  city: string | null;
} {
  const t = raw?.trim();
  if (!t) return { zone: null, oblast: null, city: null };
  const parts = t
    .split(/\s*\/\s*|[,;|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    zone: parts[0] ?? null,
    oblast: parts[1] ?? null,
    city: parts[2] ?? null
  };
}

export function buildUserTerritory(parts: {
  zone?: string | null;
  oblast?: string | null;
  city?: string | null;
}): string | null {
  const arr = [parts.zone, parts.oblast, parts.city]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return arr.length > 0 ? arr.join(" / ") : null;
}

export function applyTerritoryFieldPatch(
  existing: string | null | undefined,
  patch: {
    territory_zone?: string | null;
    territory_oblast?: string | null;
    territory_city?: string | null;
  }
): string | null | undefined {
  const touched =
    patch.territory_zone !== undefined ||
    patch.territory_oblast !== undefined ||
    patch.territory_city !== undefined;
  if (!touched) return undefined;
  const cur = parseUserTerritoryPartsFromHelpers(existing);
  return buildUserTerritory({
    zone: patch.territory_zone !== undefined ? patch.territory_zone : cur.zone,
    oblast: patch.territory_oblast !== undefined ? patch.territory_oblast : cur.oblast,
    city: patch.territory_city !== undefined ? patch.territory_city : cur.city
  });
}
