import type { MobileOrderVisitInput } from "../../contracts/mobile-order-visit.schemas";

/** Web sozlamada radius berilmagan bo‘lsa vizit/zakaz uchun standart radius. */
export const DEFAULT_ORDER_VISIT_RADIUS_M = 300;
/** GPS aniqligi hisobiga ruxsat etilgan qo‘shimcha masofa (maksimum). */
export const MAX_ACCURACY_TOLERANCE_M = 50;
/** Oflayn zakaz kechroq yuborilishi mumkin — vizit shu muddatdan eski bo‘lmasin. */
export const MAX_VISIT_AGE_MS = 36 * 3600 * 1000;
const FUTURE_SKEW_MS = 5 * 60 * 1000;

export type OrderVisitErrorCode =
  | "VISIT_REQUIRED"
  | "VISIT_CLIENT_MISMATCH"
  | "VISIT_MOCK_LOCATION"
  | "VISIT_BAD_TIME"
  | "VISIT_STALE"
  | "VISIT_OUT_OF_RADIUS";

export type OrderVisitGeo = {
  legacy?: true;
  visit_started_at?: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number | null;
  distance_m?: number | null;
  reported_distance_m?: number | null;
  radius_m?: number;
  client_has_coords?: boolean;
  order_latitude?: number | null;
  order_longitude?: number | null;
  order_accuracy_m?: number | null;
  order_distance_m?: number | null;
  tracking?: boolean | null;
  offline?: boolean | null;
  checked_at: string;
};

export type OrderVisitEvaluation =
  | { ok: true; geo: OrderVisitGeo; startedAt: Date | null }
  | { ok: false; code: OrderVisitErrorCode; meta?: Record<string, unknown> };

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function resolveOrderVisitRadiusM(configRadiusM: number | null | undefined): number {
  return configRadiusM != null && configRadiusM > 0 ? configRadiusM : DEFAULT_ORDER_VISIT_RADIUS_M;
}

export function evaluateOrderVisit(input: {
  visit: MobileOrderVisitInput | null | undefined;
  clientId: number;
  clientLat: number | null;
  clientLng: number | null;
  configRadiusM: number | null | undefined;
  /** Yangi ilova `X-App-Version` yuboradi — eski APK lar vizitsiz ham o‘tadi (min_version bilan yopiladi). */
  strict: boolean;
  now?: Date;
}): OrderVisitEvaluation {
  const now = input.now ?? new Date();
  const checkedAt = now.toISOString();
  const v = input.visit;
  if (!v) {
    if (input.strict) return { ok: false, code: "VISIT_REQUIRED" };
    return { ok: true, geo: { legacy: true, checked_at: checkedAt }, startedAt: null };
  }
  if (v.client_id !== input.clientId) return { ok: false, code: "VISIT_CLIENT_MISMATCH" };
  if (v.is_mocked === true || v.order_is_mocked === true) return { ok: false, code: "VISIT_MOCK_LOCATION" };

  const startedAt = new Date(v.started_at);
  if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > now.getTime() + FUTURE_SKEW_MS) {
    return { ok: false, code: "VISIT_BAD_TIME" };
  }
  if (now.getTime() - startedAt.getTime() > MAX_VISIT_AGE_MS) return { ok: false, code: "VISIT_STALE" };

  const radius = resolveOrderVisitRadiusM(input.configRadiusM);
  const hasCoords = input.clientLat != null && input.clientLng != null;
  let distance: number | null = null;
  let orderDistance: number | null = null;
  if (hasCoords) {
    distance = Math.round(distanceMeters(v.latitude, v.longitude, input.clientLat!, input.clientLng!));
    const tolerance = Math.min(Math.max(v.accuracy_m ?? 0, 0), MAX_ACCURACY_TOLERANCE_M);
    if (distance > radius + tolerance) {
      return { ok: false, code: "VISIT_OUT_OF_RADIUS", meta: { distance_m: distance, radius_m: radius } };
    }
    if (v.order_latitude != null && v.order_longitude != null) {
      orderDistance = Math.round(
        distanceMeters(v.order_latitude, v.order_longitude, input.clientLat!, input.clientLng!)
      );
    }
  }

  return {
    ok: true,
    startedAt: startedAt.getTime() > now.getTime() ? now : startedAt,
    geo: {
      visit_started_at: startedAt.toISOString(),
      latitude: v.latitude,
      longitude: v.longitude,
      accuracy_m: v.accuracy_m ?? null,
      distance_m: distance,
      reported_distance_m: v.distance_m ?? null,
      radius_m: radius,
      client_has_coords: hasCoords,
      order_latitude: v.order_latitude ?? null,
      order_longitude: v.order_longitude ?? null,
      order_accuracy_m: v.order_accuracy_m ?? null,
      order_distance_m: orderDistance,
      tracking: v.tracking ?? null,
      offline: v.offline ?? null,
      checked_at: checkedAt
    }
  };
}

export const ORDER_VISIT_ERROR_RU: Record<OrderVisitErrorCode, string> = {
  VISIT_REQUIRED: "Заказ можно оформить только в рамках визита: начните визит у клиента",
  VISIT_CLIENT_MISMATCH: "Визит начат у другого клиента",
  VISIT_MOCK_LOCATION: "Обнаружена подмена геолокации — заказ отклонён",
  VISIT_BAD_TIME: "Неверное время начала визита — проверьте часы телефона",
  VISIT_STALE: "Визит устарел — начните новый визит",
  VISIT_OUT_OF_RADIUS: "Визит начат слишком далеко от клиента"
};
