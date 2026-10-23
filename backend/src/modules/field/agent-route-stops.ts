/** AgentRouteDay.stops JSON — xarita / GPS monitoring bilan bir xil shakl. */

export type AgentRouteStop = {
  sort_order: number;
  client_id: number;
  client_name: string;
  latitude: number | null;
  longitude: number | null;
  visited: boolean;
};

const WORK_REGION_UTC_OFFSET_HOURS = 5;

export function workRegionIsoDate(d = new Date()): string {
  const wr = new Date(d.getTime() + WORK_REGION_UTC_OFFSET_HOURS * 3_600_000);
  return wr.toISOString().slice(0, 10);
}

/** Joriy ish-haftasidagi (Du–Ya) sanalar: tashrif kunlari → `yyyy-MM-dd`. */
export function isoDatesThisWeekForWeekdays(weekdays: number[], now = new Date()): string[] {
  const uniq = [...new Set(weekdays.filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b);
  if (uniq.length === 0) return [];
  const todayKey = workRegionIsoDate(now);
  const [y, m, day] = todayKey.split("-").map((x) => Number.parseInt(x, 10));
  const todayUtc = Date.UTC(y, m - 1, day);
  const utcDay = new Date(todayUtc).getUTCDay();
  const jsWeekday = utcDay === 0 ? 7 : utcDay;
  return uniq.map((wd) => {
    const dt = new Date(todayUtc + (wd - jsWeekday) * 86_400_000);
    return dt.toISOString().slice(0, 10);
  });
}

function asStopMap(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function stopClientId(raw: unknown): number | null {
  const m = asStopMap(raw);
  if (!m) return null;
  const n = Number(m.client_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function appendStopToRouteStops(
  stops: unknown,
  stop: {
    client_id: number;
    client_name: string;
    latitude?: number | null;
    longitude?: number | null;
  }
): AgentRouteStop[] {
  const list = Array.isArray(stops) ? stops : [];
  const existingIds = new Set<number>();
  const out: AgentRouteStop[] = [];
  for (let i = 0; i < list.length; i++) {
    const row = asStopMap(list[i]);
    const id = stopClientId(list[i]);
    if (id != null) existingIds.add(id);
    const lat = row?.latitude ?? row?.lat;
    const lon = row?.longitude ?? row?.lon ?? row?.lng;
    out.push({
      sort_order: Number(row?.sort_order ?? row?.sort ?? row?.order ?? i + 1) || i + 1,
      client_id: id ?? 0,
      client_name: String(row?.client_name ?? row?.name ?? ""),
      latitude: lat != null && Number.isFinite(Number(lat)) ? Number(lat) : null,
      longitude: lon != null && Number.isFinite(Number(lon)) ? Number(lon) : null,
      visited: row?.visited === true
    });
  }
  if (existingIds.has(stop.client_id)) return out.filter((s) => s.client_id > 0);
  out.push({
    sort_order: out.length + 1,
    client_id: stop.client_id,
    client_name: stop.client_name,
    latitude: stop.latitude ?? null,
    longitude: stop.longitude ?? null,
    visited: false
  });
  return out.filter((s) => s.client_id > 0);
}

/** Sync / kartochka: data-URL ni yubormaymiz (hajm). */
export function compactClientPhotoUrl(raw: string | null | undefined): string | undefined {
  const s = raw?.trim() ?? "";
  if (!s || s.startsWith("data:") || s.length > 2048) return undefined;
  return s;
}
