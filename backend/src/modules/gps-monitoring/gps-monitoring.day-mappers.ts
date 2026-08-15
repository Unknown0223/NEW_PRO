import { Prisma } from "@prisma/client";
import { haversineKm, hourFloatFromDate } from "./gps-monitoring.helpers";
import type { GpsVisitPhotoDto } from "./gps-monitoring.types";

const PHOTO_URL_MAX_INLINE = 120_000;
export const WAS_AT_POINT_KM = 0.2;

type StopRaw = {
  sort_order?: number;
  client_id?: number;
  client_name?: string;
  latitude?: number;
  longitude?: number;
  visited?: boolean;
};

export function asStops(raw: Prisma.JsonValue): StopRaw[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is StopRaw => x != null && typeof x === "object");
}

export function refLabelMap(
  entries: Array<{ code?: string | null; name?: string | null }> | undefined
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries ?? []) {
    const value = (e.code?.trim() || e.name?.trim() || "").trim();
    if (value) map.set(value, e.name?.trim() || value);
  }
  return map;
}

export function toPhotoDto(row: {
  id: number;
  caption: string | null;
  created_at: Date;
  image_url: string;
  content_purged_at: Date | null;
}): GpsVisitPhotoDto {
  const purged = row.content_purged_at != null || !String(row.image_url ?? "").trim();
  const raw = purged ? "" : String(row.image_url);
  const includeUrl =
    !purged &&
    (raw.startsWith("http://") ||
      raw.startsWith("https://") ||
      raw.startsWith("/") ||
      (raw.startsWith("data:") && raw.length <= PHOTO_URL_MAX_INLINE));
  return {
    id: row.id,
    caption: row.caption,
    created_at: row.created_at.toISOString(),
    content_purged: purged,
    ...(includeUrl ? { image_url: raw } : {})
  };
}

export function nearestPingDistanceKm(
  pings: Array<{ latitude: Prisma.Decimal; longitude: Prisma.Decimal; recorded_at: Date }>,
  lat: number,
  lng: number,
  aroundHour: number | null
): number | null {
  if (pings.length === 0) return null;
  let best: number | null = null;
  for (const p of pings) {
    const h = hourFloatFromDate(p.recorded_at);
    if (aroundHour != null && Math.abs(h - aroundHour) > 0.75) continue;
    const d = haversineKm(Number(p.latitude), Number(p.longitude), lat, lng);
    if (best == null || d < best) best = d;
  }
  if (best == null) {
    for (const p of pings) {
      const d = haversineKm(Number(p.latitude), Number(p.longitude), lat, lng);
      if (best == null || d < best) best = d;
    }
  }
  return best == null ? null : Math.round(best * 1000) / 1000;
}
