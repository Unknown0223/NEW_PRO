/**
 * Work-slot territory satrlari («zona / oblast / shahar» yoki multi-city)
 * klient manziliga mos keladimi — ish joyidagi kaskad bilan bir xil.
 *
 * Muhim: klientda shahar/viloyat **kod** (`XR_XIVA`) bo‘lishi mumkin,
 * ish joyida esa **nom** (`XIVA`) — ikkalasini ham tanib oladi.
 */

export function normTerritoryToken(s: string): string {
  return s.trim().toUpperCase().replace(/[\s\-_]+/g, " ");
}

/** Faqat geografik tur so‘zlari — o‘zaro «mos» deb hisoblanmasin (VILOYATI≡VILOYATI). */
const GEO_TYPE_WORDS = new Set(["VILOYATI", "SHAHAR", "TUMANI", "TUMAN", "ZONE", "ZONA"]);

/** Kod/nom variantlari: XR_XIVA → XIVA; XORAZM VILOYATI → XORAZM */
export function territoryTokenVariants(raw: string): string[] {
  const n = normTerritoryToken(raw);
  if (!n) return [];
  const out = new Set<string>([n]);
  const parts = n.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]!;
    if (!GEO_TYPE_WORDS.has(last)) out.add(last);
    const restFrom1 = parts.slice(1).join(" ");
    if (restFrom1 && !GEO_TYPE_WORDS.has(restFrom1)) out.add(restFrom1);
    const withoutLast = parts.slice(0, -1).join(" ");
    if (withoutLast) out.add(withoutLast);
  }
  for (const p of [...out]) {
    const stripped = p
      .replace(/\bVILOYATI\b/g, "")
      .replace(/\bSHAHAR\b/g, "")
      .replace(/\bTUMANI\b/g, "")
      .replace(/\bTUMAN\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped && !GEO_TYPE_WORDS.has(stripped)) out.add(stripped);
  }
  return [...out].filter((x) => x.length >= 2 && !GEO_TYPE_WORDS.has(x));
}

export function territoryTokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  const va = territoryTokenVariants(a);
  const vb = territoryTokenVariants(b);
  for (const x of va) {
    for (const y of vb) {
      if (x === y) return true;
      if (x.length >= 3 && y.length >= 3 && (x.endsWith(y) || y.endsWith(x))) return true;
    }
  }
  return false;
}

function tokenInList(token: string, list: string[]): boolean {
  return list.some((x) => territoryTokensMatch(token, x));
}

type Addr = { zone?: string | null; region?: string | null; city?: string | null };

type Coverage = {
  zones: string[];
  oblasts: string[];
  cities: string[];
  /** Oblast darajasida (shahar yo‘q) — butun viloyat */
  oblastCover: string[];
  /** Zona darajasida (oblast/shahar yo‘q) — butun zona */
  zoneCover: string[];
};

function pushUnique(arr: string[], v: string | null | undefined) {
  const t = v?.trim();
  if (!t) return;
  if (!arr.some((x) => territoryTokensMatch(x, t))) arr.push(t);
}

function isLikelyOblastToken(token: string): boolean {
  const u = token.trim().toUpperCase();
  return (
    u.includes("VILOYATI") ||
    u === "QORAQALPOQISTON" ||
    u === "TOSHKENT SHAHAR" ||
    u === "SAMARQAND"
  );
}

function isLikelyZoneToken(token: string): boolean {
  const u = token.trim().toUpperCase();
  return (
    u === "FV" ||
    u === "SOUTH-WEST" ||
    u === "SOUTH WEST" ||
    u === "NORTH" ||
    u === "EAST" ||
    u === "WEST" ||
    u === "CENTER" ||
    u.startsWith("ZONE")
  );
}

/** Bitta territory satridan zona/oblast/shahar(lar)ni yig‘ish. */
export function collectCoverageFromTerritoryString(raw: string | null | undefined): Coverage {
  const out: Coverage = {
    zones: [],
    oblasts: [],
    cities: [],
    oblastCover: [],
    zoneCover: []
  };
  const t = raw?.trim() ?? "";
  if (!t) return out;

  // Avval « / » bo‘yicha yo‘l; keyin shahar qismi vergul bilan bo‘lishi mumkin
  const slashParts = t
    .split(/\s*\/\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (slashParts.length >= 3) {
    const zone = slashParts[0]!;
    const oblast = slashParts[1]!;
    const cityBlob = slashParts.slice(2).join(" / ");
    const cities = cityBlob
      .split(/\s*[,;|]\s*/)
      .map((c) => c.trim())
      .filter(Boolean);
    pushUnique(out.zones, zone);
    pushUnique(out.oblasts, oblast);
    for (const c of cities) pushUnique(out.cities, c);
    return out;
  }

  if (slashParts.length === 2) {
    const a = slashParts[0]!;
    const b = slashParts[1]!;
    // «oblast / city» yoki «zone / oblast»
    if (isLikelyOblastToken(a) && !isLikelyZoneToken(a)) {
      pushUnique(out.oblasts, a);
      pushUnique(out.cities, b);
      return out;
    }
    pushUnique(out.zones, a);
    pushUnique(out.oblasts, b);
    pushUnique(out.oblastCover, b);
    return out;
  }

  // Bitta token yoki vergul bilan ro‘yxat
  const tokens = t
    .split(/\s*[,;|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (tokens.length > 1) {
    for (const tok of tokens) {
      if (isLikelyZoneToken(tok)) pushUnique(out.zones, tok);
      else if (isLikelyOblastToken(tok)) {
        pushUnique(out.oblasts, tok);
        pushUnique(out.oblastCover, tok);
      } else pushUnique(out.cities, tok);
    }
    return out;
  }

  const only = tokens[0]!;
  if (isLikelyZoneToken(only)) {
    pushUnique(out.zones, only);
    pushUnique(out.zoneCover, only);
  } else if (isLikelyOblastToken(only)) {
    pushUnique(out.oblasts, only);
    pushUnique(out.oblastCover, only);
  } else {
    pushUnique(out.cities, only);
  }
  return out;
}

export function mergeCoverage(parts: Coverage[]): Coverage {
  const out: Coverage = {
    zones: [],
    oblasts: [],
    cities: [],
    oblastCover: [],
    zoneCover: []
  };
  for (const p of parts) {
    for (const z of p.zones) pushUnique(out.zones, z);
    for (const o of p.oblasts) pushUnique(out.oblasts, o);
    for (const c of p.cities) pushUnique(out.cities, c);
    for (const o of p.oblastCover) pushUnique(out.oblastCover, o);
    for (const z of p.zoneCover) pushUnique(out.zoneCover, z);
  }
  return out;
}

/**
 * Ish joyidagi barcha territory satrlari (primary + territories[]) klient manziliga mosmi.
 */
export function staffTerritoriesMatchAddress(
  territoryBlobs: Array<string | null | undefined>,
  address: Addr
): boolean {
  const zone = (address.zone ?? "").trim();
  const region = (address.region ?? "").trim();
  const city = (address.city ?? "").trim();
  if (!zone && !region && !city) return false;

  const cov = mergeCoverage(
    territoryBlobs
      .filter((b): b is string => typeof b === "string" && b.trim().length > 0)
      .map((b) => collectCoverageFromTerritoryString(b))
  );

  // Path ichida to‘g‘ridan-to‘g‘ri substring (segment) — kod/nom chalkashmasin
  const blobHit = (needle: string) =>
    territoryBlobs.some((b) => {
      if (typeof b !== "string" || !b.trim()) return false;
      const parts = b
        .split(/\s*\/\s*|[,;|]\s*/)
        .map((p) => p.trim())
        .filter(Boolean);
      return parts.some((p) => territoryTokensMatch(p, needle));
    });

  if (city) {
    const cityHit = tokenInList(city, cov.cities) || blobHit(city);
    if (cityHit) {
      if (region && cov.oblasts.length > 0 && !tokenInList(region, cov.oblasts)) return false;
      if (zone && cov.zones.length > 0 && !tokenInList(zone, cov.zones)) return false;
      return true;
    }
    // Shahar yo‘q — faqat oblast/zona coverage (shaharsiz yo‘llar).
    // blobHit(region) ishlatilmaydi: aks holda boshqa shahar yo‘li ham «viloyat» deb o‘tadi.
    if (region && tokenInList(region, cov.oblastCover)) {
      if (zone && cov.zones.length > 0 && !tokenInList(zone, cov.zones)) return false;
      return true;
    }
    if (zone && tokenInList(zone, cov.zoneCover)) return true;
    return false;
  }

  if (region) {
    if (tokenInList(region, cov.oblasts) || tokenInList(region, cov.oblastCover) || blobHit(region)) {
      return true;
    }
    if (zone && (tokenInList(zone, cov.zoneCover) || blobHit(zone))) return true;
    return false;
  }

  if (zone) {
    return tokenInList(zone, cov.zones) || tokenInList(zone, cov.zoneCover) || blobHit(zone);
  }

  return false;
}

/** @deprecated — bitta satr uchun; yangi kod staffTerritoriesMatchAddress ishlatsin */
export function staffTerritoryStringMatchesAddress(
  territoryRaw: string | null | undefined,
  address: Addr
): boolean {
  return staffTerritoriesMatchAddress([territoryRaw], address);
}
