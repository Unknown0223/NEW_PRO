import {
  SHARE_NOT_SAME_LOCATION,
  SHARE_PHOTO_REQUIRED,
  ShareError
} from "./share-codes";

export const DEFAULT_SHARE_HANDOFF_METERS = 150;

export type LatLng = { lat: number; lng: number };
export type HandoffParty = LatLng & { photo_key: string };

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function validateHandoffPair(
  a: HandoffParty,
  b: HandoffParty,
  maxMeters = DEFAULT_SHARE_HANDOFF_METERS
): void {
  if (!a.photo_key?.trim() || !b.photo_key?.trim()) {
    throw new ShareError(SHARE_PHOTO_REQUIRED);
  }
  if (
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    throw new ShareError(SHARE_NOT_SAME_LOCATION);
  }
  if (haversineMeters(a, b) > maxMeters) {
    throw new ShareError(SHARE_NOT_SAME_LOCATION);
  }
}
