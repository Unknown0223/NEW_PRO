import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  mapDbRoleToType,
  regionOfTerritory,
  roleFilterToDbRoles
} from "./gps-monitoring.helpers";
import { ONLINE_MAX_AGE_MS, type GpsOverviewAgentDto, type GpsOverviewClusterDto, type GpsTradingPointDto } from "./gps-monitoring.types";

const FALLBACK_CLUSTERS: GpsOverviewClusterDto[] = [
  { id: "c1", lat: 41.315, lng: 69.27, count: 0, label: "Toshkent" },
  { id: "c2", lat: 40.79, lng: 72.34, count: 0, label: "Farg'ona" },
  { id: "c3", lat: 40.99, lng: 71.67, count: 0, label: "Qo'qon" },
  { id: "c4", lat: 40.53, lng: 70.94, count: 0, label: "Jizzax" },
  { id: "c5", lat: 41.55, lng: 60.62, count: 0, label: "Urganch" },
  { id: "c6", lat: 39.67, lng: 66.94, count: 0, label: "Samarqand" },
  { id: "c7", lat: 40.5, lng: 68.78, count: 0, label: "Sirdaryo" },
  { id: "c8", lat: 40.78, lng: 72.35, count: 0, label: "Andijon" },
  { id: "c9", lat: 41.0, lng: 71.67, count: 0, label: "Namangan" },
  { id: "c10", lat: 39.77, lng: 64.42, count: 0, label: "Buxoro" },
  { id: "c11", lat: 40.1, lng: 65.37, count: 0, label: "Navoiy" },
  { id: "c12", lat: 42.46, lng: 59.61, count: 0, label: "Nukus" }
];

function fallbackForRegion(region: string): { lat: number; lng: number } {
  const hit = FALLBACK_CLUSTERS.find((c) => c.label === region);
  return hit ?? FALLBACK_CLUSTERS[0]!;
}

/** Bir xil nuqtadagi agentlar — Clusterer sonini ko‘rsatishi uchun grid round. */
function gridKey(lat: number, lng: number, precision = 3): string {
  return `${lat.toFixed(precision)},${lng.toFixed(precision)}`;
}

export async function listGpsMonitoringOverview(
  tenantId: number,
  opts?: { role?: string | null }
): Promise<{ clusters: GpsOverviewClusterDto[]; agents: GpsOverviewAgentDto[] }> {
  const dbRoles = roleFilterToDbRoles(opts?.role);
  const users = await prisma.user.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      role: { in: dbRoles }
    },
    select: {
      id: true,
      login: true,
      name: true,
      code: true,
      role: true,
      territory: true,
      branch: true,
      agent_type: true,
      warehouse_id: true
    }
  });

  const userIds = users.map((u) => u.id);
  const latest =
    userIds.length === 0
      ? []
      : await prisma.$queryRaw<{ agent_id: number; latitude: unknown; longitude: unknown; recorded_at: Date }[]>`
          SELECT DISTINCT ON (agent_id)
            agent_id, latitude, longitude, recorded_at
          FROM agent_location_pings
          WHERE tenant_id = ${tenantId}
            AND agent_id IN (${Prisma.join(userIds)})
            AND recorded_at > NOW() - INTERVAL '48 hours'
          ORDER BY agent_id, recorded_at DESC
        `;

  const pingBy = new Map(latest.map((p) => [p.agent_id, p]));
  const now = Date.now();

  const warehouseIds = users.map((u) => u.warehouse_id).filter((x): x is number => x != null);
  const vanWh =
    warehouseIds.length === 0
      ? new Set<number>()
      : new Set(
          (
            await prisma.warehouse.findMany({
              where: { tenant_id: tenantId, id: { in: warehouseIds }, van_selling: true },
              select: { id: true }
            })
          ).map((w) => w.id)
        );

  const agents: GpsOverviewAgentDto[] = users.map((u) => {
    const region = regionOfTerritory(u.territory ?? u.branch);
    const ping = pingBy.get(u.id);
    const fb = fallbackForRegion(region);
    const lat = ping ? Number(ping.latitude) : fb.lat;
    const lng = ping ? Number(ping.longitude) : fb.lng;
    const type = mapDbRoleToType(u.role, {
      vanSelling: u.warehouse_id != null && vanWh.has(u.warehouse_id),
      agentType: u.agent_type
    });
    const online =
      ping != null && now - new Date(ping.recorded_at).getTime() <= ONLINE_MAX_AGE_MS;
    return {
      id: String(u.id),
      code: (u.code?.trim() || u.login).toUpperCase(),
      name: u.name,
      lat,
      lng,
      region,
      type,
      online
    };
  });

  // Geo-grid cluster (bir nuqta / yaqin joylar) — son bilan
  const buckets = new Map<string, { lat: number; lng: number; count: number; label: string }>();
  for (const a of agents) {
    const key = gridKey(a.lat, a.lng);
    const prev = buckets.get(key);
    if (!prev) {
      buckets.set(key, { lat: a.lat, lng: a.lng, count: 1, label: a.region });
    } else {
      prev.count += 1;
      // Label: agar bir nechta region — eng ko‘p uchragan yoki birinchi
      if (prev.count === 2 && prev.label !== a.region) prev.label = `${prev.label}+`;
    }
  }

  const clusters: GpsOverviewClusterDto[] =
    buckets.size > 0
      ? [...buckets.entries()].map(([id, b], i) => ({
          id: `g-${i}-${id}`,
          lat: b.lat,
          lng: b.lng,
          count: b.count,
          label: b.label
        }))
      : FALLBACK_CLUSTERS;

  return { clusters, agents };
}

export async function listGpsTradingPoints(
  tenantId: number,
  opts?: { limit?: number }
): Promise<{ points: GpsTradingPointDto[] }> {
  const take = Math.min(Math.max(opts?.limit ?? 80, 1), 200);
  const clients = await prisma.client.findMany({
    where: {
      tenant_id: tenantId,
      merged_into_client_id: null,
      latitude: { not: null },
      longitude: { not: null },
      is_active: true
    },
    select: { id: true, name: true, latitude: true, longitude: true },
    take,
    orderBy: { id: "asc" }
  });

  return {
    points: clients.map((c) => ({
      id: String(c.id),
      name: c.name,
      lat: Number(c.latitude),
      lng: Number(c.longitude)
    }))
  };
}
