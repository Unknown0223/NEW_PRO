import { Prisma } from "@prisma/client";
import { haversineKm, hourFloatFromDate } from "./gps-monitoring.helpers";
import type { GpsVisitPointDto } from "./gps-monitoring.types";

export type GpsNetworkLabel = GpsVisitPointDto["internet"];

export type GpsPingMeta = {
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  recorded_at: Date;
  battery_pct?: number | null;
  network_type?: string | null;
};

/** Mobil/API tarmoq qiymatini monitoring UI labeliga. */
export function normalizeGpsNetworkType(raw: string | null | undefined): GpsNetworkLabel {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t || t === "—" || t === "-" || t === "none" || t === "offline") return "—";
  if (t === "wifi" || t === "wi-fi" || t === "ethernet") return "WiFi";
  if (t === "3g" || t === "2g" || t === "edge" || t === "gprs") return "3G";
  if (t === "4g" || t === "5g" || t === "lte" || t === "mobile" || t === "cellular") return "4G";
  return "—";
}

export function clampBatteryPct(raw: number | null | undefined): number | null {
  if (raw == null || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  if (n < 0 || n > 100) return null;
  return n;
}

/** Nuqta vaqtiga eng yaqin ping — masofa + batareya/tarmoq. */
export function nearestPingMeta(
  pings: GpsPingMeta[],
  lat: number,
  lng: number,
  aroundHour: number | null
): {
  distanceKm: number | null;
  batteryAt: number | null;
  internet: GpsNetworkLabel;
} {
  if (pings.length === 0) {
    return { distanceKm: null, batteryAt: null, internet: "—" };
  }

  const pickBest = (candidates: GpsPingMeta[]) => {
    let best: GpsPingMeta | null = null;
    let bestD: number | null = null;
    for (const p of candidates) {
      const d = haversineKm(Number(p.latitude), Number(p.longitude), lat, lng);
      if (bestD == null || d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return { best, bestD };
  };

  let scoped = pings;
  if (aroundHour != null) {
    const near = pings.filter((p) => Math.abs(hourFloatFromDate(p.recorded_at) - aroundHour) <= 0.75);
    if (near.length) scoped = near;
  }

  const { best, bestD } = pickBest(scoped);
  if (!best || bestD == null) {
    return { distanceKm: null, batteryAt: null, internet: "—" };
  }
  return {
    distanceKm: Math.round(bestD * 1000) / 1000,
    batteryAt: clampBatteryPct(best.battery_pct ?? null),
    internet: normalizeGpsNetworkType(best.network_type)
  };
}

/** Ro‘yxat: avval shu kunda faol, keyin nom. */
export function sortEmployeesActiveFirst<T extends { activeOnDate?: boolean; name: string }>(
  rows: T[]
): T[] {
  return [...rows].sort((a, b) => {
    const aa = a.activeOnDate === false ? 1 : 0;
    const bb = b.activeOnDate === false ? 1 : 0;
    if (aa !== bb) return aa - bb;
    return a.name.localeCompare(b.name, "uz");
  });
}
