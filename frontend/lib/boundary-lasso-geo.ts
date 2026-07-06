import type { GeoBoundaryPoint } from "@/lib/geo-boundaries-types";

export type ScreenPoint = { x: number; y: number };

/** Ekran lassosini xaritadagi polygon nuqtalariga aylantiradi. */
export function lassoScreenToGeoPolygon(
  screenPts: ScreenPoint[],
  unproject: (x: number, y: number) => { lat: number; lng: number } | null,
  maxVertices = 64
): GeoBoundaryPoint[] {
  if (screenPts.length < 3) return [];

  const step = Math.max(1, Math.floor(screenPts.length / maxVertices));
  const raw: GeoBoundaryPoint[] = [];

  for (let i = 0; i < screenPts.length; i += step) {
    const p = screenPts[i]!;
    const geo = unproject(p.x, p.y);
    if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lng)) {
      raw.push({ lat: geo.lat, lng: geo.lng });
    }
  }

  if (raw.length < 3) return [];

  const deduped: GeoBoundaryPoint[] = [];
  for (const p of raw) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(last.lat - p.lat) > 1e-6 || Math.abs(last.lng - p.lng) > 1e-6) {
      deduped.push(p);
    }
  }

  return deduped.length >= 3 ? deduped : [];
}

export function pointInScreenPolygon(point: ScreenPoint, poly: ScreenPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]!.x;
    const yi = poly[i]!.y;
    const xj = poly[j]!.x;
    const yj = poly[j]!.y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
