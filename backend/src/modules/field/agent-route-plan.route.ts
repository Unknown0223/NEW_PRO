import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import {
  assertOrderAgentAllowedForActor,
  enrichScopedReportActor,
  resolveAllowedAgentIdsForActor
} from "../access/access-agent-scope";
import { ensureAnyPermission } from "../access/ensure-any-permission";
import { DIRECTORY_READ_ROLES, getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { parseVisitWeekdaysJson } from "../clients/clients.types";
import { toFio } from "../staff/staff.shared.helpers";

export type RoutePlanClient = {
  client_id: number;
  client_name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  visit_weekdays: number[];
};

/** `yyyy-MM-dd` → savdo UI hafta kuni (1=Du … 7=Ya). */
export function salesWeekdayOf(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  const js = d.getUTCDay();
  return js === 0 ? 7 : js;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Agentga biriktirilgan faol mijozlar (tashrif kunlari bilan). */
export async function listAgentRoutePool(tenantId: number, agentId: number): Promise<RoutePlanClient[]> {
  const rows = await prisma.client.findMany({
    where: {
      tenant_id: tenantId,
      is_active: true,
      merged_into_client_id: null,
      OR: [{ agent_id: agentId }, { agent_assignments: { some: { agent_id: agentId } } }]
    },
    select: {
      id: true,
      name: true,
      address: true,
      latitude: true,
      longitude: true,
      agent_assignments: { where: { agent_id: agentId }, select: { visit_weekdays: true } }
    },
    orderBy: { name: "asc" },
    take: 2000
  });
  return rows.map((c) => ({
    client_id: c.id,
    client_name: c.name,
    address: c.address ?? null,
    latitude: num(c.latitude),
    longitude: num(c.longitude),
    visit_weekdays: [...new Set(c.agent_assignments.flatMap((a) => parseVisitWeekdaysJson(a.visit_weekdays)))].sort(
      (a, b) => a - b
    )
  }));
}

export async function registerAgentRoutePlanRoutes(app: FastifyInstance) {
  app.get("/api/:slug/agent-route-days/agents", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    if (!(await ensureAnyPermission(request, reply, ["gps.marshrut.view", "gps.marshrut.update"]))) return;
    const tenantId = request.tenant!.id;
    const actor = await enrichScopedReportActor(tenantId, {
      userId: actorUserIdOrNull(request),
      role: getAccessUser(request).role ?? ""
    });
    const allowed = resolveAllowedAgentIdsForActor(actor);
    if (allowed !== null && allowed.length === 0) return reply.send({ data: [] });
    const rows = await prisma.user.findMany({
      where: {
        tenant_id: tenantId,
        role: "agent",
        is_active: true,
        ...(allowed !== null ? { id: { in: allowed } } : {})
      },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, first_name: true, last_name: true, middle_name: true, code: true }
    });
    return reply.send({ data: rows.map((u) => ({ id: u.id, name: toFio(u), code: u.code })) });
  });

  app.get("/api/:slug/agent-route-days/suggest", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = z
      .object({
        agent_id: z.coerce.number().int().positive(),
        route_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })
      .parse(request.query);
    if (!(await ensureAnyPermission(request, reply, ["gps.marshrut.view", "gps.marshrut.update"]))) return;
    const viewer = getAccessUser(request);
    try {
      await assertOrderAgentAllowedForActor(request.tenant!.id, q.agent_id, {
        userId: actorUserIdOrNull(request),
        role: viewer.role ?? ""
      });
    } catch (e) {
      if (e instanceof Error && e.message === "AGENT_OUT_OF_SCOPE") {
        return sendApiError(reply, request, 403, "AgentOutOfScope");
      }
      throw e;
    }
    const weekday = salesWeekdayOf(q.route_date);
    if (weekday == null) return sendApiError(reply, request, 400, "InvalidDate");
    const pool = await listAgentRoutePool(request.tenant!.id, q.agent_id);
    const planned = pool.filter((c) => c.visit_weekdays.includes(weekday));
    return reply.send({ data: { weekday, planned, pool } });
  });
}
