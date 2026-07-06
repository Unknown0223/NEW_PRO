import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

// ── Agent GPS pings (trek) ───────────────────────────────────────────────

export type AgentLocationPingRow = {
  id: number;
  agent_id: number;
  latitude: string;
  longitude: string;
  accuracy_meters: number | null;
  recorded_at: string;
};

export async function recordAgentLocationPing(
  tenantId: number,
  agentId: number,
  input: { latitude: number; longitude: number; accuracy_meters?: number | null }
): Promise<AgentLocationPingRow> {
  const user = await prisma.user.findFirst({
    where: {
      id: agentId,
      tenant_id: tenantId,
      role: { in: ["agent", "expeditor"] },
      is_active: true
    },
    select: { id: true }
  });
  if (!user) throw new Error("AgentNotFound");

  const row = await prisma.agentLocationPing.create({
    data: {
      tenant_id: tenantId,
      agent_id: agentId,
      latitude: new Prisma.Decimal(input.latitude),
      longitude: new Prisma.Decimal(input.longitude),
      accuracy_meters:
        input.accuracy_meters != null && Number.isFinite(input.accuracy_meters)
          ? input.accuracy_meters
          : null
    }
  });
  return {
    id: row.id,
    agent_id: row.agent_id,
    latitude: row.latitude.toString(),
    longitude: row.longitude.toString(),
    accuracy_meters: row.accuracy_meters,
    recorded_at: row.recorded_at.toISOString()
  };
}

export async function listAgentLocationPings(
  tenantId: number,
  opts: { agent_id: number; from: Date; to: Date; limit: number }
): Promise<{ data: AgentLocationPingRow[]; truncated: boolean }> {
  const take = Math.min(Math.max(opts.limit, 1), 5000);
  const rows = await prisma.agentLocationPing.findMany({
    where: {
      tenant_id: tenantId,
      agent_id: opts.agent_id,
      recorded_at: { gte: opts.from, lte: opts.to }
    },
    orderBy: { recorded_at: "asc" },
    take: take + 1
  });
  const truncated = rows.length > take;
  const sliced = truncated ? rows.slice(0, take) : rows;
  return {
    data: sliced.map((r) => ({
      id: r.id,
      agent_id: r.agent_id,
      latitude: r.latitude.toString(),
      longitude: r.longitude.toString(),
      accuracy_meters: r.accuracy_meters,
      recorded_at: r.recorded_at.toISOString()
    })),
    truncated
  };
}

// ── Agent visits (GPS check-in / hisobot «По визитам») ─────────────────────

export type AgentVisitRow = {
  id: number;
  tenant_id: number;
  agent_id: number;
  client_id: number | null;
  checked_in_at: string;
  checked_out_at: string | null;
  latitude: string | null;
  longitude: string | null;
  notes: string | null;
};

/**
 * Agent mijoz oldida check-in — `agent_visits` + ixtiyoriy `clients.last_visit_at` yangilanishi.
 */
export async function recordAgentVisitCheckin(
  tenantId: number,
  agentId: number,
  input: {
    client_id?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
    checked_in_at?: Date | null;
  }
): Promise<AgentVisitRow> {
  const agent = await prisma.user.findFirst({
    where: { id: agentId, tenant_id: tenantId, role: { in: ["agent", "expeditor"] }, is_active: true },
    select: { id: true }
  });
  if (!agent) throw new Error("AgentNotFound");

  const clientId = input.client_id != null && Number.isFinite(input.client_id) ? input.client_id : null;
  if (clientId != null) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, tenant_id: tenantId, merged_into_client_id: null },
      select: { id: true }
    });
    if (!client) throw new Error("ClientNotFound");
  }

  const checkedIn = input.checked_in_at ?? new Date();
  const lat =
    input.latitude != null && Number.isFinite(input.latitude)
      ? new Prisma.Decimal(input.latitude)
      : null;
  const lng =
    input.longitude != null && Number.isFinite(input.longitude)
      ? new Prisma.Decimal(input.longitude)
      : null;

  const row = await prisma.agentVisit.create({
    data: {
      tenant_id: tenantId,
      agent_id: agentId,
      client_id: clientId,
      checked_in_at: checkedIn,
      latitude: lat,
      longitude: lng,
      notes: input.notes?.trim() ? input.notes.trim().slice(0, 2000) : null
    }
  });

  if (clientId != null) {
    await prisma.$executeRaw`
      UPDATE clients
      SET last_visit_at = GREATEST(COALESCE(last_visit_at, '1970-01-01'::timestamp), ${checkedIn})
      WHERE id = ${clientId} AND tenant_id = ${tenantId}
    `;
  }

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    agent_id: row.agent_id,
    client_id: row.client_id,
    checked_in_at: row.checked_in_at.toISOString(),
    checked_out_at: row.checked_out_at ? row.checked_out_at.toISOString() : null,
    latitude: row.latitude?.toString() ?? null,
    longitude: row.longitude?.toString() ?? null,
    notes: row.notes
  };
}

/** --- Route day --- */
export async function getAgentRouteDay(tenantId: number, agentId: number, routeDateIso: string) {
  const d = new Date(routeDateIso);
  if (Number.isNaN(d.getTime())) return null;
  const day = startOfUtcDay(d);
  const row = await prisma.agentRouteDay.findUnique({
    where: {
      tenant_id_agent_id_route_date: { tenant_id: tenantId, agent_id: agentId, route_date: day }
    },
    include: { agent: { select: { id: true, name: true, login: true } } }
  });
  return row ? serializeRouteDay(row) : null;
}

function serializeRouteDay(r: {
  id: number;
  route_date: Date;
  stops: Prisma.JsonValue;
  notes: string | null;
  updated_at: Date;
  agent: { id: number; name: string; login: string };
}) {
  return {
    id: r.id,
    route_date: r.route_date.toISOString().slice(0, 10),
    stops: r.stops,
    notes: r.notes,
    updated_at: r.updated_at.toISOString(),
    agent: r.agent
  };
}

export async function upsertAgentRouteDay(
  tenantId: number,
  body: {
    agent_id: number;
    route_date: string;
    stops: unknown;
    notes?: string | null;
  }
) {
  const agent = await prisma.user.findFirst({
    where: { id: body.agent_id, tenant_id: tenantId, role: "agent", is_active: true },
    select: { id: true }
  });
  if (!agent) throw new Error("AgentNotFound");
  const d = new Date(body.route_date);
  if (Number.isNaN(d.getTime())) throw new Error("InvalidDate");
  const day = startOfUtcDay(d);
  const stops = Array.isArray(body.stops) ? body.stops : [];
  const row = await prisma.agentRouteDay.upsert({
    where: {
      tenant_id_agent_id_route_date: { tenant_id: tenantId, agent_id: body.agent_id, route_date: day }
    },
    create: {
      tenant_id: tenantId,
      agent_id: body.agent_id,
      route_date: day,
      stops: stops as Prisma.InputJsonValue,
      notes: body.notes?.trim() || null
    },
    update: {
      stops: stops as Prisma.InputJsonValue,
      notes: body.notes !== undefined ? body.notes?.trim() || null : undefined
    },
    include: { agent: { select: { id: true, name: true, login: true } } }
  });
  return serializeRouteDay(row);
}

export async function listAgentRouteDays(
  tenantId: number,
  opts: { agent_id?: number; from?: string; to?: string; page: number; limit: number }
) {
  const where: Prisma.AgentRouteDayWhereInput = { tenant_id: tenantId };
  if (opts.agent_id) where.agent_id = opts.agent_id;
  if (opts.from || opts.to) {
    where.route_date = {};
    if (opts.from) {
      const f = new Date(opts.from);
      if (!Number.isNaN(f.getTime())) (where.route_date as Prisma.DateTimeFilter).gte = startOfUtcDay(f);
    }
    if (opts.to) {
      const t = new Date(opts.to);
      if (!Number.isNaN(t.getTime())) {
        const end = startOfUtcDay(t);
        end.setUTCDate(end.getUTCDate() + 1);
        (where.route_date as Prisma.DateTimeFilter).lt = end;
      }
    }
  }
  const skip = (opts.page - 1) * opts.limit;
  const [total, rows] = await Promise.all([
    prisma.agentRouteDay.count({ where }),
    prisma.agentRouteDay.findMany({
      where,
      orderBy: { route_date: "desc" },
      skip,
      take: opts.limit,
      include: { agent: { select: { id: true, name: true, login: true } } }
    })
  ]);
  return {
    data: rows.map(serializeRouteDay),
    total,
    page: opts.page,
    limit: opts.limit
  };
}
