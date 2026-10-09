import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getActiveSlotForUser } from "../work-slots/work-slots.query.read";
import {
  appendStopToRouteStops,
  isoDatesThisWeekForWeekdays
} from "./agent-route-stops";

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
  battery_pct: number | null;
  network_type: string | null;
  recorded_at: string;
};

export async function recordAgentLocationPing(
  tenantId: number,
  agentId: number,
  input: {
    latitude: number;
    longitude: number;
    accuracy_meters?: number | null;
    battery_pct?: number | null;
    network_type?: string | null;
    recorded_at?: Date | null;
  }
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

  const recordedAt = clampClientRecordedAt(input.recorded_at ?? null);
  const battery =
    input.battery_pct != null && Number.isFinite(input.battery_pct)
      ? Math.max(0, Math.min(100, Math.round(input.battery_pct)))
      : null;
  const network =
    input.network_type != null && String(input.network_type).trim()
      ? String(input.network_type).trim().slice(0, 16)
      : null;

  const row = await prisma.agentLocationPing.create({
    data: {
      tenant_id: tenantId,
      agent_id: agentId,
      latitude: new Prisma.Decimal(input.latitude),
      longitude: new Prisma.Decimal(input.longitude),
      accuracy_meters:
        input.accuracy_meters != null && Number.isFinite(input.accuracy_meters)
          ? input.accuracy_meters
          : null,
      battery_pct: battery,
      network_type: network,
      ...(recordedAt ? { recorded_at: recordedAt } : {})
    }
  });
  return {
    id: row.id,
    agent_id: row.agent_id,
    latitude: row.latitude.toString(),
    longitude: row.longitude.toString(),
    accuracy_meters: row.accuracy_meters,
    battery_pct: row.battery_pct,
    network_type: row.network_type,
    recorded_at: row.recorded_at.toISOString()
  };
}

/** Client oflayn flush: 7 kun orqaga / 5 daqiqa oldinga cheklov. */
export function clampClientRecordedAt(raw: Date | null | undefined, now = new Date()): Date | null {
  if (raw == null || Number.isNaN(raw.getTime())) return null;
  const maxFutureMs = 5 * 60 * 1000;
  const maxPastMs = 7 * 24 * 60 * 60 * 1000;
  if (raw.getTime() > now.getTime() + maxFutureMs) return now;
  if (raw.getTime() < now.getTime() - maxPastMs) return new Date(now.getTime() - maxPastMs);
  return raw;
}

export async function recordAgentLocationPingsBatch(
  tenantId: number,
  agentId: number,
  pings: Array<{
    latitude: number;
    longitude: number;
    accuracy_meters?: number | null;
    battery_pct?: number | null;
    network_type?: string | null;
    recorded_at?: Date | null;
  }>
): Promise<{ inserted: number }> {
  if (!pings.length) return { inserted: 0 };
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

  const now = new Date();
  const data = pings.slice(0, 200).map((p) => {
    const recordedAt = clampClientRecordedAt(p.recorded_at ?? null, now);
    const battery =
      p.battery_pct != null && Number.isFinite(p.battery_pct)
        ? Math.max(0, Math.min(100, Math.round(p.battery_pct)))
        : null;
    const network =
      p.network_type != null && String(p.network_type).trim()
        ? String(p.network_type).trim().slice(0, 16)
        : null;
    return {
      tenant_id: tenantId,
      agent_id: agentId,
      latitude: new Prisma.Decimal(p.latitude),
      longitude: new Prisma.Decimal(p.longitude),
      accuracy_meters:
        p.accuracy_meters != null && Number.isFinite(p.accuracy_meters) ? p.accuracy_meters : null,
      battery_pct: battery,
      network_type: network,
      recorded_at: recordedAt ?? now
    };
  });

  const result = await prisma.agentLocationPing.createMany({ data });
  return { inserted: result.count };
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
      battery_pct: r.battery_pct,
      network_type: r.network_type,
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
  const activeSlot = await getActiveSlotForUser(body.agent_id);
  const row = await prisma.agentRouteDay.upsert({
    where: {
      tenant_id_agent_id_route_date: { tenant_id: tenantId, agent_id: body.agent_id, route_date: day }
    },
    create: {
      tenant_id: tenantId,
      agent_id: body.agent_id,
      route_date: day,
      work_slot_id: activeSlot?.slot_id ?? null,
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

/** Mavjud kunlik marshrutga nuqta qo‘shish (yangi bo‘sh marshrut yaratilmaydi). */
export async function appendClientToExistingAgentRouteDays(
  tenantId: number,
  agentId: number,
  stop: {
    client_id: number;
    client_name: string;
    latitude?: number | null;
    longitude?: number | null;
  },
  visitWeekdays: number[]
): Promise<void> {
  const dates = isoDatesThisWeekForWeekdays(visitWeekdays);
  if (dates.length === 0) return;
  for (const routeDate of dates) {
    const existing = await getAgentRouteDay(tenantId, agentId, routeDate);
    if (!existing) continue;
    const next = appendStopToRouteStops(existing.stops, stop);
    const prevLen = Array.isArray(existing.stops) ? existing.stops.length : 0;
    if (next.length === prevLen) continue;
    await upsertAgentRouteDay(tenantId, {
      agent_id: agentId,
      route_date: routeDate,
      stops: next,
      notes: existing.notes
    });
  }
}

export async function listAgentRouteDays(
  tenantId: number,
  opts: {
    agent_id?: number;
    agent_ids?: number[];
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }
) {
  const where: Prisma.AgentRouteDayWhereInput = { tenant_id: tenantId };
  if (opts.agent_id) where.agent_id = opts.agent_id;
  else if (opts.agent_ids) where.agent_id = { in: opts.agent_ids };
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
