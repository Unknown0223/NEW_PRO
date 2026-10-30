import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  endOfLocalDay,
  fmtLastSeen,
  mapDbRoleToType,
  regionOfTerritory,
  roleFilterToDbRoles,
  startOfLocalDay
} from "./gps-monitoring.helpers";
import {
  clampBatteryPct,
  normalizeGpsNetworkType,
  sortEmployeesActiveFirst
} from "./gps-monitoring.ping-meta";
import { ONLINE_MAX_AGE_MS, type GpsEmployeeDto } from "./gps-monitoring.types";

type UserRow = {
  id: number;
  login: string;
  name: string;
  code: string | null;
  role: string;
  territory: string | null;
  branch: string | null;
  trade_direction: string | null;
  agent_type: string | null;
  supervisor_user_id: number | null;
  warehouse_id: number | null;
};

type PingRow = {
  agent_id: number;
  recorded_at: Date;
  latitude: unknown;
  longitude: unknown;
  battery_pct: number | null;
  network_type: string | null;
};

async function vanSellingWarehouseIds(tenantId: number, warehouseIds: number[]): Promise<Set<number>> {
  if (warehouseIds.length === 0) return new Set();
  const rows = await prisma.warehouse.findMany({
    where: { tenant_id: tenantId, id: { in: warehouseIds }, van_selling: true, is_active: true },
    select: { id: true }
  });
  return new Set(rows.map((r) => r.id));
}

/** Shu kunda GPS / vizit / zakaz / otkaz / foto bo‘lgan agent id lar. */
export async function loadActiveAgentIdsForDate(
  tenantId: number,
  userIds: number[],
  dateIso: string
): Promise<Set<number>> {
  if (userIds.length === 0) return new Set();
  const from = startOfLocalDay(dateIso);
  const to = endOfLocalDay(dateIso);
  const ids = Prisma.join(userIds);

  const [pingIds, visitIds, orderAgentIds, orderExpIds, refusalIds, photoIds] = await Promise.all([
    prisma.$queryRaw<{ agent_id: number }[]>`
      SELECT DISTINCT agent_id FROM agent_location_pings
      WHERE tenant_id = ${tenantId}
        AND agent_id IN (${ids})
        AND recorded_at >= ${from} AND recorded_at <= ${to}
    `,
    prisma.$queryRaw<{ agent_id: number }[]>`
      SELECT DISTINCT agent_id FROM agent_visits
      WHERE tenant_id = ${tenantId}
        AND agent_id IN (${ids})
        AND checked_in_at >= ${from} AND checked_in_at <= ${to}
    `,
    prisma.$queryRaw<{ agent_id: number }[]>`
      SELECT DISTINCT agent_id FROM orders
      WHERE tenant_id = ${tenantId}
        AND order_type = 'order'
        AND agent_id IN (${ids})
        AND created_at >= ${from} AND created_at <= ${to}
    `,
    prisma.$queryRaw<{ expeditor_user_id: number }[]>`
      SELECT DISTINCT expeditor_user_id FROM orders
      WHERE tenant_id = ${tenantId}
        AND order_type = 'order'
        AND expeditor_user_id IN (${ids})
        AND created_at >= ${from} AND created_at <= ${to}
    `,
    prisma.$queryRaw<{ agent_id: number }[]>`
      SELECT DISTINCT agent_id FROM client_refusals
      WHERE tenant_id = ${tenantId}
        AND agent_id IN (${ids})
        AND created_at >= ${from} AND created_at <= ${to}
    `,
    prisma.$queryRaw<{ created_by_user_id: number }[]>`
      SELECT DISTINCT created_by_user_id FROM client_photo_reports
      WHERE tenant_id = ${tenantId}
        AND created_by_user_id IN (${ids})
        AND deleted_at IS NULL
        AND created_at >= ${from} AND created_at <= ${to}
    `
  ]);

  const out = new Set<number>();
  for (const r of pingIds) out.add(r.agent_id);
  for (const r of visitIds) out.add(r.agent_id);
  for (const r of orderAgentIds) if (r.agent_id != null) out.add(r.agent_id);
  for (const r of orderExpIds) if (r.expeditor_user_id != null) out.add(r.expeditor_user_id);
  for (const r of refusalIds) out.add(r.agent_id);
  for (const r of photoIds) if (r.created_by_user_id != null) out.add(r.created_by_user_id);
  return out;
}

async function loadLatestPingsForAgents(
  tenantId: number,
  userIds: number[],
  dateIso?: string
): Promise<Map<number, PingRow>> {
  if (userIds.length === 0) return new Map();
  const ids = Prisma.join(userIds);

  const rows =
    dateIso != null && /^\d{4}-\d{2}-\d{2}$/.test(dateIso.trim())
      ? await prisma.$queryRaw<PingRow[]>`
          SELECT DISTINCT ON (agent_id)
            agent_id, recorded_at, latitude, longitude, battery_pct, network_type
          FROM agent_location_pings
          WHERE tenant_id = ${tenantId}
            AND agent_id IN (${ids})
            AND recorded_at >= ${startOfLocalDay(dateIso)}
            AND recorded_at <= ${endOfLocalDay(dateIso)}
          ORDER BY agent_id, recorded_at DESC
        `
      : await prisma.$queryRaw<PingRow[]>`
          SELECT DISTINCT ON (agent_id)
            agent_id, recorded_at, latitude, longitude, battery_pct, network_type
          FROM agent_location_pings
          WHERE tenant_id = ${tenantId}
            AND agent_id IN (${ids})
          ORDER BY agent_id, recorded_at DESC
        `;

  return new Map(rows.map((p) => [p.agent_id, p]));
}

function toEmployeeDto(
  u: UserRow,
  opts: {
    vanWh: Set<number>;
    ping: PingRow | undefined;
    activeOnDate: boolean;
    now: number;
  }
): GpsEmployeeDto {
  const lastAt = opts.ping?.recorded_at ?? null;
  const online = lastAt != null && opts.now - lastAt.getTime() <= ONLINE_MAX_AGE_MS;
  const type = mapDbRoleToType(u.role, {
    vanSelling: u.warehouse_id != null && opts.vanWh.has(u.warehouse_id),
    agentType: u.agent_type
  });
  return {
    id: String(u.id),
    code: (u.code?.trim() || u.login).toUpperCase(),
    name: u.name,
    territory: u.territory?.trim() || u.branch?.trim() || "—",
    segment: u.trade_direction?.trim() || u.branch?.trim() || type.toUpperCase().slice(0, 3),
    type,
    supervisorId: u.supervisor_user_id != null ? String(u.supervisor_user_id) : null,
    battery: clampBatteryPct(opts.ping?.battery_pct ?? null),
    network: opts.ping ? normalizeGpsNetworkType(opts.ping.network_type) : null,
    online,
    lastSeen: fmtLastSeen(lastAt),
    region: regionOfTerritory(u.territory ?? u.branch),
    activeOnDate: opts.activeOnDate
  };
}

export async function listGpsMonitoringEmployees(
  tenantId: number,
  opts: { date?: string; role?: string | null }
): Promise<{ employees: GpsEmployeeDto[]; supervisors: { id: string; label: string }[] }> {
  const dbRoles = roleFilterToDbRoles(opts.role);
  const vansellOnly = (opts.role ?? "").trim().toLowerCase() === "vansell";
  const dateIso =
    opts.date != null && /^\d{4}-\d{2}-\d{2}$/.test(opts.date.trim()) ? opts.date.trim() : undefined;

  const users = (await prisma.user.findMany({
    where: { tenant_id: tenantId, is_active: true, role: { in: dbRoles } },
    select: {
      id: true,
      login: true,
      name: true,
      code: true,
      role: true,
      territory: true,
      branch: true,
      trade_direction: true,
      agent_type: true,
      supervisor_user_id: true,
      warehouse_id: true
    },
    orderBy: [{ name: "asc" }]
  })) as UserRow[];

  const whIds = users.map((u) => u.warehouse_id).filter((x): x is number => x != null);
  const vanWh = await vanSellingWarehouseIds(tenantId, whIds);

  let filtered = users;
  if (vansellOnly) {
    filtered = users.filter(
      (u) =>
        (u.warehouse_id != null && vanWh.has(u.warehouse_id)) ||
        /vansell|van.?sell/i.test(u.agent_type ?? "")
    );
  } else if ((opts.role ?? "").trim().toLowerCase() === "agent") {
    filtered = users.filter(
      (u) =>
        !(u.warehouse_id != null && vanWh.has(u.warehouse_id)) &&
        !/vansell|van.?sell/i.test(u.agent_type ?? "")
    );
  }

  const userIds = filtered.map((u) => u.id);
  const [pingByAgent, activeIds] = await Promise.all([
    loadLatestPingsForAgents(tenantId, userIds, dateIso),
    dateIso ? loadActiveAgentIdsForDate(tenantId, userIds, dateIso) : Promise.resolve(null)
  ]);

  const now = Date.now();
  const employees = sortEmployeesActiveFirst(
    filtered.map((u) =>
      toEmployeeDto(u, {
        vanWh,
        ping: pingByAgent.get(u.id),
        activeOnDate: activeIds == null ? true : activeIds.has(u.id),
        now
      })
    )
  );

  const supervisors = filtered
    .filter((u) => u.role === "supervisor")
    .map((u) => ({
      id: String(u.id),
      label: `(${(u.code?.trim() || u.login).toUpperCase()}) ${u.name}`
    }));

  if ((opts.role ?? "").trim().toLowerCase() !== "supervisor") {
    const parentIds = [
      ...new Set(filtered.map((u) => u.supervisor_user_id).filter((x): x is number => x != null))
    ];
    if (parentIds.length) {
      const parents = await prisma.user.findMany({
        where: { tenant_id: tenantId, id: { in: parentIds }, role: "supervisor" },
        select: { id: true, name: true, code: true, login: true }
      });
      for (const p of parents) {
        if (!supervisors.some((s) => s.id === String(p.id))) {
          supervisors.push({
            id: String(p.id),
            label: `(${(p.code?.trim() || p.login).toUpperCase()}) ${p.name}`
          });
        }
      }
    }
  }

  supervisors.sort((a, b) => a.label.localeCompare(b.label, "uz"));
  return { employees, supervisors };
}

export async function buildGpsEmployeeDto(
  tenantId: number,
  userId: number,
  dateIso?: string
): Promise<GpsEmployeeDto | null> {
  const u = await prisma.user.findFirst({
    where: {
      id: userId,
      tenant_id: tenantId,
      is_active: true,
      role: { in: ["agent", "expeditor", "supervisor", "collector"] }
    },
    select: {
      id: true,
      login: true,
      name: true,
      code: true,
      role: true,
      territory: true,
      branch: true,
      trade_direction: true,
      agent_type: true,
      supervisor_user_id: true,
      warehouse_id: true
    }
  });
  if (!u) return null;

  let vanSelling = false;
  if (u.warehouse_id != null) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: u.warehouse_id, tenant_id: tenantId, van_selling: true },
      select: { id: true }
    });
    vanSelling = Boolean(wh);
  }

  const dayOk = dateIso != null && /^\d{4}-\d{2}-\d{2}$/.test(dateIso.trim());
  const pingWhere =
    dayOk
      ? {
          tenant_id: tenantId,
          agent_id: userId,
          recorded_at: { gte: startOfLocalDay(dateIso!), lte: endOfLocalDay(dateIso!) }
        }
      : { tenant_id: tenantId, agent_id: userId };

  const lastPing = await prisma.agentLocationPing.findFirst({
    where: pingWhere,
    orderBy: { recorded_at: "desc" },
    select: { recorded_at: true, battery_pct: true, network_type: true }
  });

  let activeOnDate = true;
  if (dayOk) {
    const active = await loadActiveAgentIdsForDate(tenantId, [userId], dateIso!);
    activeOnDate = active.has(userId);
  }

  const online =
    lastPing != null && Date.now() - lastPing.recorded_at.getTime() <= ONLINE_MAX_AGE_MS;

  return {
    id: String(u.id),
    code: (u.code?.trim() || u.login).toUpperCase(),
    name: u.name,
    territory: u.territory?.trim() || u.branch?.trim() || "—",
    segment: u.trade_direction?.trim() || u.branch?.trim() || u.role.toUpperCase().slice(0, 3),
    type: mapDbRoleToType(u.role, { vanSelling, agentType: u.agent_type }),
    supervisorId: u.supervisor_user_id != null ? String(u.supervisor_user_id) : null,
    battery: clampBatteryPct(lastPing?.battery_pct ?? null),
    network: lastPing ? normalizeGpsNetworkType(lastPing.network_type) : null,
    online,
    lastSeen: fmtLastSeen(lastPing?.recorded_at),
    region: regionOfTerritory(u.territory ?? u.branch),
    activeOnDate
  };
}
