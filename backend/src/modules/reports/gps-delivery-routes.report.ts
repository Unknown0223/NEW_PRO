import { prisma } from "../../config/database";
import type { ReportActor } from "./client-sales-4-report.service";
import type { GpsDeliveryRouteRow, GpsDeliveryRoutesFilters } from "./gps-delivery-routes.types";

const GEOFENCE_M = 200;
const AVG_SPEED_M_PER_SEC = 25_000 / 3600; // ~25 km/h
const STOP_SEC = 180;

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function dayBounds(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T23:59:59.999`);
  return { from, to };
}

function pathLengthM(coords: Array<{ lat: number; lng: number }>): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) {
    sum += haversineM(coords[i - 1]!.lat, coords[i - 1]!.lng, coords[i]!.lat, coords[i]!.lng);
  }
  return sum;
}

/** DB ismida telefon bo‘lsa (+998… Name) — faqat ismni qoldiramiz. */
function cleanExpeditorName(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) return "—";
  const cleaned = s
    .replace(/^\+?\d{9,15}[\s\u00a0\u202f]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || s;
}

export async function getGpsDeliveryRoutesReport(
  tenantId: number,
  filters: GpsDeliveryRoutesFilters,
  _actor?: ReportActor
): Promise<{
  from: string;
  to: string;
  page: number;
  limit: number;
  total: number;
  rows: GpsDeliveryRouteRow[];
}> {
  const { from, to } = dayBounds(filters.from, filters.to);

  const whereExp: {
    tenant_id: number;
    role: string;
    is_active: boolean;
    app_access?: boolean;
    id?: { in: number[] };
    branch?: { in: string[] };
    OR?: Array<Record<string, unknown>>;
  } = {
    tenant_id: tenantId,
    role: "expeditor",
    is_active: true
  };
  if (filters.app_users_only) whereExp.app_access = true;
  if (filters.expeditor_ids.length) whereExp.id = { in: filters.expeditor_ids };
  if (filters.branch_names.length) whereExp.branch = { in: filters.branch_names };
  if (filters.search?.trim()) {
    const q = filters.search.trim();
    whereExp.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { login: { contains: q, mode: "insensitive" } }
    ];
  }

  const expeditors = await prisma.user.findMany({
    where: whereExp,
    select: {
      id: true,
      name: true,
      code: true,
      branch: true,
      app_access: true,
      phone: true
    },
    orderBy: { name: "asc" }
  });

  const ids = expeditors.map((e) => e.id);
  if (ids.length === 0) {
    return {
      from: filters.from,
      to: filters.to,
      page: filters.page,
      limit: filters.limit,
      total: 0,
      rows: []
    };
  }

  const [visits, pings] = await Promise.all([
    prisma.agentVisit.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: { in: ids },
        checked_in_at: { gte: from, lte: to }
      },
      select: {
        agent_id: true,
        checked_in_at: true,
        checked_out_at: true,
        latitude: true,
        longitude: true,
        client: { select: { latitude: true, longitude: true } }
      },
      orderBy: { checked_in_at: "asc" }
    }),
    prisma.agentLocationPing.findMany({
      where: {
        tenant_id: tenantId,
        agent_id: { in: ids },
        recorded_at: { gte: from, lte: to }
      },
      select: {
        agent_id: true,
        recorded_at: true,
        latitude: true,
        longitude: true
      },
      orderBy: { recorded_at: "asc" },
      take: 80_000
    })
  ]);

  const visitsBy = new Map<number, typeof visits>();
  for (const v of visits) {
    const list = visitsBy.get(v.agent_id) ?? [];
    list.push(v);
    visitsBy.set(v.agent_id, list);
  }
  const pingsBy = new Map<number, typeof pings>();
  for (const p of pings) {
    const list = pingsBy.get(p.agent_id) ?? [];
    list.push(p);
    pingsBy.set(p.agent_id, list);
  }

  const allRows: GpsDeliveryRouteRow[] = expeditors.map((e, idx) => {
    const ev = visitsBy.get(e.id) ?? [];
    const ep = pingsBy.get(e.id) ?? [];

    let atPoint = 0;
    let outside = 0;
    let actualFromVisits = 0;
    const visitCoords: Array<{ lat: number; lng: number }> = [];

    for (const v of ev) {
      const vLat = num(v.latitude);
      const vLng = num(v.longitude);
      const cLat = num(v.client?.latitude);
      const cLng = num(v.client?.longitude);
      if (v.checked_out_at) {
        actualFromVisits += Math.max(
          0,
          (v.checked_out_at.getTime() - v.checked_in_at.getTime()) / 1000
        );
      } else {
        actualFromVisits += STOP_SEC;
      }
      if (vLat != null && vLng != null) {
        visitCoords.push({ lat: vLat, lng: vLng });
        if (cLat != null && cLng != null && haversineM(vLat, vLng, cLat, cLng) > GEOFENCE_M) {
          outside += 1;
        } else {
          atPoint += 1;
        }
      } else if (cLat != null && cLng != null) {
        visitCoords.push({ lat: cLat, lng: cLng });
        // GPS yo‘q, lekin mijoz nuqtasi reja — tashrif sifatida «был в точке»
        atPoint += 1;
      } else {
        outside += 1;
      }
    }

    const pingCoords = ep
      .map((p) => {
        const lat = num(p.latitude);
        const lng = num(p.longitude);
        return lat != null && lng != null ? { lat, lng } : null;
      })
      .filter((x): x is { lat: number; lng: number } => x != null);

    const calculated_route_m = pathLengthM(pingCoords.length > 1 ? pingCoords : visitCoords);
    const expected_route_m = pathLengthM(visitCoords);

    let actual_time_sec = actualFromVisits;
    if (ep.length >= 2) {
      const span =
        (ep[ep.length - 1]!.recorded_at.getTime() - ep[0]!.recorded_at.getTime()) / 1000;
      if (span > actual_time_sec) actual_time_sec = span;
    }

    const calculated_time_sec =
      calculated_route_m / AVG_SPEED_M_PER_SEC + ev.length * STOP_SEC;
    const expected_time_sec = expected_route_m / AVG_SPEED_M_PER_SEC + ev.length * STOP_SEC;

    const code = (e.code?.trim() || "").toLowerCase() || String(e.id);

    return {
      row_number: idx + 1,
      expeditor_id: e.id,
      expeditor_name: cleanExpeditorName(e.name),
      expeditor_code: code,
      branch: e.branch,
      app_access: e.app_access,
      actual_time_sec: Math.round(actual_time_sec * 10) / 10,
      calculated_time_sec: Math.round(calculated_time_sec * 10) / 10,
      calculated_route_m: Math.round(calculated_route_m * 10) / 10,
      expected_route_m: Math.round(expected_route_m * 10) / 10,
      expected_time_sec: Math.round(expected_time_sec * 10) / 10,
      visits_count: ev.length,
      at_point: atPoint,
      outside_point: outside
    };
  });

  // Keep rows that have any activity in range (like template often shows active ones);
  // still include zero-activity if filtered by specific ids
  const activeRows =
    filters.expeditor_ids.length > 0
      ? allRows
      : allRows.filter(
          (r) =>
            r.visits_count > 0 ||
            r.calculated_route_m > 0 ||
            r.actual_time_sec > 0
        );

  const total = activeRows.length;
  const start = (filters.page - 1) * filters.limit;
  const pageRows = activeRows.slice(start, start + filters.limit).map((r, i) => ({
    ...r,
    row_number: start + i + 1
  }));

  return {
    from: filters.from,
    to: filters.to,
    page: filters.page,
    limit: filters.limit,
    total,
    rows: pageRows
  };
}
