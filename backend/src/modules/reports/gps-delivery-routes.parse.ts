import { monthToDateYmd } from "../../lib/month-to-date";
import type { GpsDeliveryRoutesFilters } from "./gps-delivery-routes.types";

function intList(raw?: string): number[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  ];
}

function strList(raw?: string): string[] {
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 200)
    )
  ];
}

export function parseGpsDeliveryRoutesQuery(
  q: Record<string, string | undefined>
): GpsDeliveryRoutesFilters {
  const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "10", 10) || 10));
  const { from: defaultFrom, to: defaultTo } = monthToDateYmd();
  const appRaw = (q.app_users_only ?? "").trim().toLowerCase();
  return {
    from: (q.from ?? "").trim() || defaultFrom,
    to: (q.to ?? "").trim() || defaultTo,
    branch_names: strList(q.branch_names),
    expeditor_ids: intList(q.expeditor_ids),
    app_users_only: appRaw === "1" || appRaw === "true" || appRaw === "yes",
    search: q.search?.trim() || undefined,
    page,
    limit
  };
}

/** UI: sekund → "X минут Y секунды" / soat */
export function formatDurationRu(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} час${h === 1 ? "" : h < 5 ? "а" : "ов"}`);
  if (m > 0) {
    const mm =
      m % 10 === 1 && m % 100 !== 11
        ? "минута"
        : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 10 || m % 100 >= 20)
          ? "минуты"
          : "минут";
    parts.push(`${m} ${mm}`);
  }
  if (s > 0 || parts.length === 0) {
    const ss =
      s % 10 === 1 && s % 100 !== 11
        ? "секунда"
        : s % 10 >= 2 && s % 10 <= 4 && (s % 100 < 10 || s % 100 >= 20)
          ? "секунды"
          : "секунд";
    parts.push(`${s} ${ss}`);
  }
  return parts.join(" ");
}

export function formatDistanceRu(meters: number): string {
  const m = Math.max(0, Math.round(meters));
  if (m <= 0) return "";
  if (m < 1000) return `${m} м`;
  const km = Math.floor(m / 1000);
  const rest = m % 1000;
  return rest > 0 ? `${km} км, ${rest} м` : `${km} км`;
}
