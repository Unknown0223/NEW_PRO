export type GeoPoint = { latitude: number | null; longitude: number | null };

function hasCoords(p: GeoPoint): p is { latitude: number; longitude: number } {
  return p.latitude != null && p.longitude != null && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
}

/** Ikki nuqta orasidagi masofa, km (haversine). */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  if (!hasCoords(a) || !hasCoords(b)) return 0;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function routeLengthKm(points: readonly GeoPoint[]): number {
  const withCoords = points.filter(hasCoords);
  let sum = 0;
  for (let i = 1; i < withCoords.length; i++) sum += distanceKm(withCoords[i - 1]!, withCoords[i]!);
  return sum;
}

/**
 * Ochiq marshrut (qaytish yo'q): eng yaqin qo'shni + 2-opt.
 * Koordinatasiz nuqtalar oxiriga — o'z tartibida.
 * `start` berilsa (masalan, ombor/ofis) — birinchi nuqta unga eng yaqini.
 */
export function optimizeRoute<T extends GeoPoint>(points: readonly T[], start?: GeoPoint | null): T[] {
  const located = points.filter(hasCoords) as T[];
  const rest = points.filter((p) => !hasCoords(p));
  if (located.length < 3 && !start) return [...located, ...rest];

  const pool = [...located];
  const order: T[] = [];
  let cur: GeoPoint | null = start && hasCoords(start) ? start : null;
  if (!cur) {
    const first = pool.shift()!;
    order.push(first);
    cur = first;
  }
  while (pool.length > 0) {
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pool.length; i++) {
      const d = distanceKm(cur, pool[i]!);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    cur = pool.splice(best, 1)[0]!;
    order.push(cur as T);
  }

  const head: GeoPoint[] = start && hasCoords(start) ? [start] : [];
  const len = (arr: readonly GeoPoint[]) => routeLengthKm([...head, ...arr]);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 50) {
    improved = false;
    for (let i = 0; i < order.length - 1; i++) {
      for (let k = i + 1; k < order.length; k++) {
        const next = [...order.slice(0, i), ...order.slice(i, k + 1).reverse(), ...order.slice(k + 1)];
        if (len(next) + 1e-9 < len(order)) {
          order.splice(0, order.length, ...next);
          improved = true;
        }
      }
    }
  }
  return [...order, ...rest];
}
