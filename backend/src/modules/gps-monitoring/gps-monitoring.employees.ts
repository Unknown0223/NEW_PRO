import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import {
  fmtLastSeen,
  mapDbRoleToType,
  regionOfTerritory,
  roleFilterToDbRoles
} from "./gps-monitoring.helpers";
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

async function vanSellingWarehouseIds(tenantId: number, warehouseIds: number[]): Promise<Set<number>> {
  if (warehouseIds.length === 0) return new Set();
  const rows = await prisma.warehouse.findMany({
    where: { tenant_id: tenantId, id: { in: warehouseIds }, van_selling: true, is_active: true },
    select: { id: true }
  });
  return new Set(rows.map((r) => r.id));
}

export async function listGpsMonitoringEmployees(
  tenantId: number,
  opts: { date?: string; role?: string | null }
): Promise<{ employees: GpsEmployeeDto[]; supervisors: { id: string; label: string }[] }> {
  const dbRoles = roleFilterToDbRoles(opts.role);
  const vansellOnly = (opts.role ?? "").trim().toLowerCase() === "vansell";

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
  const latestPings =
    userIds.length === 0
      ? []
      : await prisma.$queryRaw<
          { agent_id: number; recorded_at: Date; latitude: unknown; longitude: unknown }[]
        >`
          SELECT DISTINCT ON (agent_id)
            agent_id, recorded_at, latitude, longitude
          FROM agent_location_pings
          WHERE tenant_id = ${tenantId}
            AND agent_id IN (${Prisma.join(userIds)})
          ORDER BY agent_id, recorded_at DESC
        `;

  const pingByAgent = new Map(latestPings.map((p) => [p.agent_id, p]));
  const now = Date.now();

  const employees: GpsEmployeeDto[] = filtered.map((u) => {
    const ping = pingByAgent.get(u.id);
    const lastAt = ping?.recorded_at ?? null;
    const online = lastAt != null && now - lastAt.getTime() <= ONLINE_MAX_AGE_MS;
    const type = mapDbRoleToType(u.role, {
      vanSelling: u.warehouse_id != null && vanWh.has(u.warehouse_id),
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
      battery: null,
      online,
      lastSeen: fmtLastSeen(lastAt),
      region: regionOfTerritory(u.territory ?? u.branch)
    };
  });

  const supervisors = filtered
    .filter((u) => u.role === "supervisor")
    .map((u) => ({
      id: String(u.id),
      label: `(${(u.code?.trim() || u.login).toUpperCase()}) ${u.name}`
    }));

  // Also include supervisors referenced as parents even if role filter excluded them
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
  userId: number
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

  const lastPing = await prisma.agentLocationPing.findFirst({
    where: { tenant_id: tenantId, agent_id: userId },
    orderBy: { recorded_at: "desc" },
    select: { recorded_at: true }
  });
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
    battery: null,
    online,
    lastSeen: fmtLastSeen(lastPing?.recorded_at),
    region: regionOfTerritory(u.territory ?? u.branch)
  };
}
