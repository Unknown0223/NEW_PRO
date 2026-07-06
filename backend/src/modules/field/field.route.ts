import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { DIRECTORY_READ_ROLES, getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  getAgentRouteDay,
  listAgentLocationPings,
  listAgentRouteDays,
  recordAgentLocationPing,
  recordAgentVisitCheckin,
  upsertAgentRouteDay
} from "./field.service";
import { createClientRefusal } from "../refusals/refusals.service";

const locationPingPostRoles = ["agent", "expeditor", ...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

function parseUserId(request: FastifyRequest) {
  const viewer = getAccessUser(request);
  const uid = Number.parseInt(viewer.sub, 10);
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

export async function registerFieldRoutes(app: FastifyInstance) {
  app.get("/api/:slug/agent-locations", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const q = z
      .object({
        agent_id: z.coerce.number().int().positive().optional(),
        from: z.string().max(40).optional(),
        to: z.string().max(40).optional(),
        limit: z.coerce.number().int().min(1).max(5000).optional()
      })
      .parse(request.query);
    const viewer = getAccessUser(request);
    let agentId = q.agent_id;
    if (viewer.role === "agent") {
      const self = parseUserId(request);
      if (!self) return sendApiError(reply, request, 400, "BadUser");
      agentId = self;
    }
    if (agentId == null) {
      return sendApiError(reply, request, 400, "AgentIdRequired");
    }
    const to = q.to ? new Date(q.to) : new Date();
    const from = q.from ? new Date(q.from) : new Date(to.getTime() - 24 * 3600 * 1000);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return sendApiError(reply, request, 400, "BadDateRange");
    }
    if (from > to) return sendApiError(reply, request, 400, "BadDateRange");
    const result = await listAgentLocationPings(tenantId, {
      agent_id: agentId,
      from,
      to,
      limit: q.limit ?? 2000
    });
    return reply.send({
      ...result,
      range: { from: from.toISOString(), to: to.toISOString() }
    });
  });

  app.post("/api/:slug/agent-visits", {
    preHandler: [jwtAccessVerify, requireRoles(...locationPingPostRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const body = z
      .object({
        client_id: z.number().int().positive().optional().nullable(),
        latitude: z.number().finite().gte(-90).lte(90).optional().nullable(),
        longitude: z.number().finite().gte(-180).lte(180).optional().nullable(),
        notes: z.string().max(2000).optional().nullable(),
        agent_id: z.number().int().positive().optional(),
        /** Mijozdan «отказ» — `client_refusals` jadvaliga yoziladi */
        refusal_reason_ref: z.string().trim().max(128).optional().nullable()
      })
      .parse(request.body);
    const viewer = getAccessUser(request);
    let agentId: number;
    // Agent va ekspeditor o'z visit check-in'ini o'zi yaratadi (agent_id = self).
    if (viewer.role === "agent" || viewer.role === "expeditor") {
      const self = parseUserId(request);
      if (!self) return sendApiError(reply, request, 400, "BadUser");
      agentId = self;
      if (body.agent_id != null && body.agent_id !== self) {
        return sendApiError(reply, request, 403, "Forbidden");
      }
    } else {
      if (body.agent_id == null) return sendApiError(reply, request, 400, "AgentIdRequired");
      agentId = body.agent_id;
    }
    try {
      const data = await recordAgentVisitCheckin(tenantId, agentId, {
        client_id: body.client_id ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        notes: body.notes ?? null
      });
      let refusal = null;
      const reasonRef = body.refusal_reason_ref?.trim();
      if (reasonRef && body.client_id != null) {
        refusal = await createClientRefusal(tenantId, agentId, {
          client_id: body.client_id,
          refusal_reason_ref: reasonRef,
          comment: body.notes ?? null
        });
      }
      return reply.status(201).send({ data, refusal });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AgentNotFound") return sendApiError(reply, request, 400, "AgentNotFound");
      if (msg === "ClientNotFound") return sendApiError(reply, request, 404, "ClientNotFound");
      if (msg === "ReasonRequired") return sendApiError(reply, request, 400, "ReasonRequired");
      throw e;
    }
  });

  app.post("/api/:slug/agent-locations", {
    preHandler: [jwtAccessVerify, requireRoles(...locationPingPostRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const body = z
      .object({
        latitude: z.number().finite().gte(-90).lte(90),
        longitude: z.number().finite().gte(-180).lte(180),
        accuracy_meters: z.number().finite().positive().max(5000).optional().nullable(),
        agent_id: z.number().int().positive().optional()
      })
      .parse(request.body);
    const viewer = getAccessUser(request);
    let agentId: number;
    if (viewer.role === "agent" || viewer.role === "expeditor") {
      const self = parseUserId(request);
      if (!self) return sendApiError(reply, request, 400, "BadUser");
      agentId = self;
      if (body.agent_id != null && body.agent_id !== self) {
        return sendApiError(reply, request, 403, "Forbidden");
      }
    } else {
      if (body.agent_id == null) return sendApiError(reply, request, 400, "AgentIdRequired");
      agentId = body.agent_id;
    }
    try {
      const data = await recordAgentLocationPing(tenantId, agentId, {
        latitude: body.latitude,
        longitude: body.longitude,
        accuracy_meters: body.accuracy_meters
      });
      return reply.status(201).send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AgentNotFound") return sendApiError(reply, request, 400, "AgentNotFound");
      throw e;
    }
  });

  app.get("/api/:slug/agent-route-days", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const q = z
      .object({
        agent_id: z.coerce.number().int().positive().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional()
      })
      .parse(request.query);
    const viewer = getAccessUser(request);
    let agentId = q.agent_id;
    if (viewer.role === "agent") {
      const self = parseUserId(request);
      if (!self) return sendApiError(reply, request, 400, "BadUser");
      agentId = self;
    }
    const result = await listAgentRouteDays(tenantId, {
      agent_id: agentId,
      from: q.from,
      to: q.to,
      page: q.page ?? 1,
      limit: q.limit ?? 31
    });
    return reply.send(result);
  });

  app.get("/api/:slug/agent-route-days/one", {
    preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const q = z
      .object({
        agent_id: z.coerce.number().int().positive(),
        route_date: z.string().min(8)
      })
      .parse(request.query);
    const viewer = getAccessUser(request);
    let agentId = q.agent_id;
    if (viewer.role === "agent") {
      const self = parseUserId(request);
      if (!self || q.agent_id !== self) return sendApiError(reply, request, 403, "Forbidden");
      agentId = self;
    }
    const row = await getAgentRouteDay(tenantId, agentId, q.route_date);
    return reply.send({ data: row });
  });

  app.put("/api/:slug/agent-route-days", {
    preHandler: [jwtAccessVerify, requireRoles(...locationPingPostRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const body = z
      .object({
        agent_id: z.number().int().positive(),
        route_date: z.string().min(8),
        stops: z.array(z.record(z.string(), z.any())).default([]),
        notes: z.string().max(2000).nullable().optional()
      })
      .parse(request.body);
    try {
      const row = await upsertAgentRouteDay(tenantId, body);
      return reply.send({ data: row });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AgentNotFound") return sendApiError(reply, request, 400, "AgentNotFound");
      if (msg === "InvalidDate") return sendApiError(reply, request, 400, "InvalidDate");
      throw e;
    }
  });
}
