import type { GeoBoundaryPoint } from "./geo-boundaries.types";
import * as polygonClipping from "polygon-clipping";

type Ring = polygonClipping.Ring;
type MultiPolygon = polygonClipping.MultiPolygon;

export function validatePolygonPoints(polygon: unknown): GeoBoundaryPoint[] {
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new Error("Polygon requires at least 3 points");
  }
  const pts: GeoBoundaryPoint[] = [];
  for (const p of polygon) {
    if (typeof p !== "object" || p === null || !("lat" in p) || !("lng" in p)) {
      throw new Error("Each vertex must be {lat, lng}");
    }
    const lat = Number((p as GeoBoundaryPoint).lat);
    const lng = Number((p as GeoBoundaryPoint).lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("Coordinates out of range");
    }
    pts.push({ lat, lng });
  }
  return pts;
}

export function pointInPolygon(lat: number, lng: number, vertices: GeoBoundaryPoint[]): boolean {
  let inside = false;
  const n = vertices.length;
  if (n < 3) return false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const vi = vertices[i]!;
    const vj = vertices[j]!;
    const intersects =
      vi.lat > lat !== vj.lat > lat &&
      lng < ((vj.lng - vi.lng) * (lat - vi.lat)) / (vj.lat - vi.lat) + vi.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function orient(a: GeoBoundaryPoint, b: GeoBoundaryPoint, c: GeoBoundaryPoint): number {
  return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
}

function onSegment(a: GeoBoundaryPoint, b: GeoBoundaryPoint, c: GeoBoundaryPoint): boolean {
  return (
    Math.min(a.lat, b.lat) <= c.lat &&
    c.lat <= Math.max(a.lat, b.lat) &&
    Math.min(a.lng, b.lng) <= c.lng &&
    c.lng <= Math.max(a.lng, b.lng)
  );
}

function segmentsIntersect(p1: GeoBoundaryPoint, p2: GeoBoundaryPoint, q1: GeoBoundaryPoint, q2: GeoBoundaryPoint): boolean {
  const o1 = orient(p1, p2, q1);
  const o2 = orient(p1, p2, q2);
  const o3 = orient(q1, q2, p1);
  const o4 = orient(q1, q2, p2);
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, p2, q2)) return true;
  if (o3 === 0 && onSegment(q1, q2, p1)) return true;
  if (o4 === 0 && onSegment(q1, q2, p2)) return true;
  return o1 > 0 !== o2 > 0 && o3 > 0 !== o4 > 0;
}

export function polygonsOverlap(a: GeoBoundaryPoint[], b: GeoBoundaryPoint[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  for (const v of a) {
    if (pointInPolygon(v.lat, v.lng, b)) return true;
  }
  for (const v of b) {
    if (pointInPolygon(v.lat, v.lng, a)) return true;
  }
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]!;
    const a2 = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]!;
      const b2 = b[(j + 1) % b.length]!;
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

function toRing(poly: GeoBoundaryPoint[]): Ring {
  const ring: Ring = poly.map((p) => [p.lng, p.lat]);
  if (ring.length < 3) return ring;
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function fromRing(ring: Ring): GeoBoundaryPoint[] {
  if (ring.length < 3) return [];
  const pts: GeoBoundaryPoint[] = ring.map(([lng, lat]) => ({ lat, lng }));
  if (pts.length > 1) {
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    if (first.lat === last.lat && first.lng === last.lng) pts.pop();
  }
  return pts.length >= 3 ? pts : [];
}

function ringArea(ring: Ring): number {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += ring[i]![0] * ring[j]![1];
    area -= ring[j]![0] * ring[i]![1];
  }
  return Math.abs(area / 2);
}

function largestPolygonFromMulti(mp: MultiPolygon): GeoBoundaryPoint[] {
  let best: GeoBoundaryPoint[] = [];
  let bestArea = 0;
  for (const poly of mp) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const area = ringArea(outer);
    if (area > bestArea) {
      bestArea = area;
      best = fromRing(outer);
    }
  }
  return best;
}

/** Subject polygon dan obstacle(lar)ni ayirish — to‘liq boolean difference. */
export function subtractPolygons(
  subject: GeoBoundaryPoint[],
  obstacles: GeoBoundaryPoint[][]
): { polygon: GeoBoundaryPoint[]; clipped: boolean; valid: boolean; removed: boolean } {
  if (subject.length < 3) return { polygon: [], clipped: false, valid: false, removed: true };

  const validObstacles = obstacles.filter((o) => o.length >= 3);
  if (validObstacles.length === 0) {
    return { polygon: subject, clipped: false, valid: true, removed: false };
  }

  let current: MultiPolygon = [[toRing(subject)]];
  let clipped = false;

  for (const obs of validObstacles) {
    const before = JSON.stringify(current);
    current = polygonClipping.difference(current, [[toRing(obs)]]);
    if (before !== JSON.stringify(current)) clipped = true;
    if (current.length === 0) {
      return { polygon: [], clipped: true, valid: false, removed: true };
    }
  }

  const result = largestPolygonFromMulti(current);
  if (result.length < 3) {
    return { polygon: [], clipped: true, valid: false, removed: true };
  }

  return { polygon: result, clipped, valid: true, removed: false };
}

/** Umumiy chegara (touch) emas — faqat maydon kesishishi. */
export function polygonsHaveAreaOverlap(
  a: GeoBoundaryPoint[],
  b: GeoBoundaryPoint[],
  minArea = 1e-12
): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const inter = polygonClipping.intersection([[toRing(a)]], [[toRing(b)]]);
  const piece = largestPolygonFromMulti(inter);
  if (piece.length < 3) return false;
  return ringArea(toRing(piece)) > minArea;
}

/** Yangi polygon ichidagi qismlarni olib tashlaydi (mavjud chegaralar saqlanadi). */
export function clipPolygonOutsideObstacles(
  incoming: GeoBoundaryPoint[],
  obstacles: GeoBoundaryPoint[][]
): { polygon: GeoBoundaryPoint[]; clipped: boolean; valid: boolean } {
  const res = subtractPolygons(incoming, obstacles);
  return { polygon: res.polygon, clipped: res.clipped, valid: res.valid };
}
