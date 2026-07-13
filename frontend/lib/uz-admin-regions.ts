import type { GeoBoundaryPoint } from "@/lib/geo-boundaries-types";
import { pointInPolygon } from "@/lib/geo-polygon";
import { lalakuExpandRegionFilterTokens, normKeyTerritoryMatch } from "@shared/territory-lalaku-seed";
import { geoBoundaryColor } from "@/lib/geo-boundary-colors";

export type UzAdminRegion = {
  id: string;
  nameUz: string;
  nameEn: string;
  nameRu: string;
  /** Har bir tashqi halqa — MultiPolygon / GeometryCollection qismlari. */
  rings: GeoBoundaryPoint[][];
};

type GeoJsonFeature = {
  properties?: {
    ADM1_UZ?: string;
    ADM1_EN?: string;
    ADM1_RU?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
    geometries?: { type?: string; coordinates?: unknown }[];
  };
};

let cache: UzAdminRegion[] | null = null;
let loadPromise: Promise<UzAdminRegion[]> | null = null;

function foldMatch(s: string): string {
  return normKeyTerritoryMatch(s);
}

function ringFromLngLatRing(ring: number[][]): GeoBoundaryPoint[] {
  const out: GeoBoundaryPoint[] = [];
  for (const pt of ring) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ lat, lng });
  }
  return out.length >= 3 ? out : [];
}

function collectRingsFromCoords(type: string | undefined, coords: unknown): GeoBoundaryPoint[][] {
  const rings: GeoBoundaryPoint[][] = [];
  if (!coords) return rings;

  if (type === "Polygon" && Array.isArray(coords)) {
    const outer = coords[0];
    if (Array.isArray(outer)) {
      const ring = ringFromLngLatRing(outer as number[][]);
      if (ring.length >= 3) rings.push(ring);
    }
    return rings;
  }

  if (type === "MultiPolygon" && Array.isArray(coords)) {
    for (const poly of coords) {
      if (!Array.isArray(poly) || !Array.isArray(poly[0])) continue;
      const ring = ringFromLngLatRing(poly[0] as number[][]);
      if (ring.length >= 3) rings.push(ring);
    }
    return rings;
  }

  return rings;
}

function ringsFromGeometry(geometry: GeoJsonFeature["geometry"]): GeoBoundaryPoint[][] {
  if (!geometry) return [];
  const direct = collectRingsFromCoords(geometry.type, geometry.coordinates);
  if (direct.length > 0) return direct;

  if (geometry.type === "GeometryCollection" && Array.isArray(geometry.geometries)) {
    const merged: GeoBoundaryPoint[][] = [];
    for (const g of geometry.geometries) {
      merged.push(...collectRingsFromCoords(g.type, g.coordinates));
    }
    return merged;
  }

  return [];
}

function parseFeature(feature: GeoJsonFeature, index: number): UzAdminRegion | null {
  const rings = ringsFromGeometry(feature.geometry);
  if (rings.length === 0) return null;
  const nameUz = (feature.properties?.ADM1_UZ ?? "").trim();
  const nameEn = (feature.properties?.ADM1_EN ?? "").trim();
  if (!nameUz && !nameEn) return null;
  return {
    id: `uz-adm1-${index}`,
    nameUz,
    nameEn,
    nameRu: (feature.properties?.ADM1_RU ?? "").trim(),
    rings
  };
}

/** O‘zbekiston viloyatlari — geoBoundaries / OSM asosidagi ADM1 chegaralar. */
export async function loadUzAdminRegions(): Promise<UzAdminRegion[]> {
  if (cache) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch("/data/uz-admin-regions.geojson");
    if (!res.ok) throw new Error("Viloyat chegaralari yuklanmadi");
    const geo = (await res.json()) as { features?: GeoJsonFeature[] };
    const list =
      geo.features?.map((f, i) => parseFeature(f, i)).filter((x): x is UzAdminRegion => x != null) ?? [];
    cache = list;
    return list;
  })();
  return loadPromise;
}

export function regionTokenMatchesAdmin(token: string, region: UzAdminRegion): boolean {
  const tokens = lalakuExpandRegionFilterTokens(token);
  const candidates = new Set<string>();
  for (const t of tokens) candidates.add(foldMatch(t));
  candidates.add(foldMatch(token));
  candidates.add(foldMatch(region.nameUz));
  candidates.add(foldMatch(region.nameEn));
  candidates.add(foldMatch(region.nameRu));

  const regionKeys = new Set([
    foldMatch(region.nameUz),
    foldMatch(region.nameEn),
    foldMatch(region.nameRu),
    foldMatch(region.nameUz.replace(/\./g, "")),
    foldMatch(region.nameEn.replace(/\s+region$/i, " viloyati")),
    foldMatch(region.nameEn.replace(/\s+city$/i, " shahar"))
  ]);

  for (const c of candidates) {
    if (!c) continue;
    for (const rk of regionKeys) {
      if (!rk) continue;
      if (c === rk || c.includes(rk) || rk.includes(c)) return true;
    }
  }
  return false;
}

export function findAdminRegionForToken(token: string, regions: UzAdminRegion[]): UzAdminRegion | null {
  const raw = token.trim();
  if (!raw) return null;

  const key = foldMatch(raw);
  const wantsCity = /shah|sh\.|city|sha$/i.test(raw) || key.includes("SHAHAR");
  const wantsVil =
    /viloyati|vil$|oblast|region|province/i.test(raw) ||
    key.includes("VILOYATI") ||
    (key.includes("VIL") && !key.includes("SHAHAR"));

  let best: UzAdminRegion | null = null;
  let bestScore = -1;

  for (const region of regions) {
    if (!regionTokenMatchesAdmin(raw, region)) continue;
    let score = 1;
    const en = region.nameEn.toLowerCase();
    const uz = region.nameUz.toLowerCase();

    if (en.includes("city") || uz.includes("sh.")) {
      score += wantsCity ? 12 : wantsVil ? -8 : 0;
    }
    if (en.includes("region") || en.includes("province") || uz.includes("viloyati")) {
      score += wantsVil ? 12 : wantsCity ? -8 : 0;
    }
    if (foldMatch(region.nameUz) === key || foldMatch(region.nameEn) === key) score += 4;

    if (score > bestScore) {
      bestScore = score;
      best = region;
    }
  }

  return best;
}

export function findAdminRegionForGps(lat: number, lng: number, regions: UzAdminRegion[]): UzAdminRegion | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  for (const region of regions) {
    if (pointInAdminRegion(lat, lng, region)) return region;
  }
  return null;
}

export function pointInAdminRegion(lat: number, lng: number, region: UzAdminRegion): boolean {
  for (const ring of region.rings) {
    if (pointInPolygon(lat, lng, ring)) return true;
  }
  return false;
}

export type VisitAdminMapPolygon = {
  id: string;
  coords: [number, number][];
  color: string;
  active: boolean;
  /** Fon viloyat chegaralari — ingichka, deyarli ko‘rinmas chiziq. */
  subtle?: boolean;
};

/** Barcha viloyatlar — xarita fonida sezilarli chegara (ADM1). */
export function buildAdminRegionReferencePolygons(regions: UzAdminRegion[]): VisitAdminMapPolygon[] {
  const stroke = "#6b7c8f";
  const out: VisitAdminMapPolygon[] = [];
  for (const region of regions) {
    region.rings.forEach((ring, ringIdx) => {
      if (ring.length < 3) return;
      out.push({
        id: `${region.id}-ref-${ringIdx}`,
        coords: ring.map((p) => [p.lat, p.lng] as [number, number]),
        color: stroke,
        active: false,
        subtle: true
      });
    });
  }
  return out;
}

/** Xaritada viloyat chegaralarini turli ranglarda chizish. */
export function buildAdminRegionMapPolygons(
  regions: UzAdminRegion[],
  selectedTokens: string[]
): VisitAdminMapPolygon[] {
  const selectedSet = new Set(
    selectedTokens.map((t) => findAdminRegionForToken(t, regions)?.id).filter((x): x is string => Boolean(x))
  );
  const hasSelection = selectedSet.size > 0;
  const out: VisitAdminMapPolygon[] = [];

  regions.forEach((region, index) => {
    const color = geoBoundaryColor(index);
    const active = !hasSelection || selectedSet.has(region.id);
    region.rings.forEach((ring, ringIdx) => {
      out.push({
        id: `${region.id}-${ringIdx}`,
        coords: ring.map((p) => [p.lat, p.lng] as [number, number]),
        color,
        active
      });
    });
  });

  return out;
}

/** Tanlangan viloyat(lar) chegarasiga mos xarita markazini hisoblash. */
export function boundsCenterForAdminTokens(
  tokens: string[],
  regions: UzAdminRegion[]
): { lat: number; lng: number } | null {
  const matched = new Set<UzAdminRegion>();
  for (const t of tokens) {
    const r = findAdminRegionForToken(t, regions);
    if (r) matched.add(r);
  }
  if (matched.size === 0) return null;

  let latSum = 0;
  let lngSum = 0;
  let n = 0;
  for (const region of matched) {
    for (const ring of region.rings) {
      for (const p of ring) {
        latSum += p.lat;
        lngSum += p.lng;
        n += 1;
      }
    }
  }
  if (n === 0) return null;
  return { lat: latSum / n, lng: lngSum / n };
}

/** Saqlash uchun eng katta halqa (yagona polygon). */
export function adminRegionPrimaryRing(region: UzAdminRegion): GeoBoundaryPoint[] {
  let best = region.rings[0] ?? [];
  for (const ring of region.rings) {
    if (ring.length > best.length) best = ring;
  }
  return best;
}

export function adminRegionForCatalogName(
  name: string,
  layer: "oblast" | "gorod",
  parentRegionName: string | undefined,
  regions: UzAdminRegion[]
): UzAdminRegion | null {
  if (layer === "oblast") return findAdminRegionForToken(name, regions);
  const parent = (parentRegionName ?? name).trim();
  return findAdminRegionForToken(parent, regions);
}
