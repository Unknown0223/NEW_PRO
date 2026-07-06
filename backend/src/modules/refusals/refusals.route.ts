import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import { appendTenantAuditEvent } from "../../lib/tenant-audit";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { DIRECTORY_READ_ROLES, getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  createClientRefusal,
  getClientRefusalFilterOptions,
  listClientRefusals
} from "./refusals.service";
import type { ListClientRefusalsQuery } from "./refusals.types";

const readRoles = [...DIRECTORY_READ_ROLES] as const;
const writeRoles = ["agent", ...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

function parseUserId(request: FastifyRequest): number | null {
  const viewer = getAccessUser(request);
  const uid = Number.parseInt(viewer.sub, 10);
  return Number.isFinite(uid) && uid > 0 ? uid : null;
}

function parseListQuery(q: Record<string, string | undefined>): ListClientRefusalsQuery {
  const exportCap = q.export_limit?.trim()
    ? Math.min(10000, Math.max(1, Number.parseInt(q.export_limit, 10) || 5000))
    : undefined;
  const page = exportCap != null ? 1 : Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
  const maxLimit = exportCap != null ? 10000 : 100;
  const limit =
    exportCap != null
      ? exportCap
      : Math.min(maxLimit, Math.max(1, Number.parseInt(q.limit ?? "20", 10) || 20));
  const agent_id = q.agent_id ? Number.parseInt(q.agent_id, 10) : undefined;
  let sort_by: ListClientRefusalsQuery["sort_by"] = "created_at";
  if (q.sort_by === "client" || q.sort_by === "agent" || q.sort_by === "reason") {
    sort_by = q.sort_by;
  }
  const sort_dir = q.sort_dir === "asc" ? "asc" : "desc";
  return {
    page,
    limit,
    max_limit: maxLimit,
    date_from: q.date_from?.trim() || undefined,
    date_to: q.date_to?.trim() || undefined,
    agent_id: agent_id != null && agent_id > 0 ? agent_id : undefined,
    refusal_reason_ref: q.refusal_reason_ref?.trim() || undefined,
    client_category: q.client_category?.trim() || undefined,
    zone: q.zone?.trim() || undefined,
    region: q.region?.trim() || undefined,
    city: q.city?.trim() || undefined,
    search: q.search?.trim() || undefined,
    sort_by,
    sort_dir
  };
}

export async function registerRefusalRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/refusals/filter-options",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await getClientRefusalFilterOptions(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/refusals",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseListQuery(request.query as Record<string, string | undefined>);
      const result = await listClientRefusals(request.tenant!.id, q);
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/refusals",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const body = z
        .object({
          client_id: z.number().int().positive(),
          refusal_reason_ref: z.string().trim().min(1).max(128),
          comment: z.string().max(2000).optional().nullable(),
          agent_id: z.number().int().positive().optional(),
          created_at: z.string().max(40).optional().nullable()
        })
        .parse(request.body);

      const viewer = getAccessUser(request);
      let agentId: number;
      if (viewer.role === "agent") {
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

      let createdAt: Date | undefined;
      if (body.created_at?.trim()) {
        const d = new Date(body.created_at);
        if (!Number.isNaN(d.getTime())) createdAt = d;
      }

      try {
        const data = await createClientRefusal(request.tenant!.id, agentId, {
          client_id: body.client_id,
          refusal_reason_ref: body.refusal_reason_ref,
          comment: body.comment ?? null,
          created_at: createdAt ?? null
        });
        await appendTenantAuditEvent({
          tenantId: request.tenant!.id,
          actorUserId: parseUserId(request),
          entityType: "refusal",
          entityId: (data as { id?: number })?.id ?? "—",
          action: "refusal.create",
          payload: {
            client_id: body.client_id,
            agent_id: agentId,
            refusal_reason_ref: body.refusal_reason_ref
          }
        });
        return reply.status(201).send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "ClientNotFound") return sendApiError(reply, request, 404, "ClientNotFound");
        if (msg === "AgentNotFound") return sendApiError(reply, request, 400, "AgentNotFound");
        if (msg === "ReasonRequired") return sendApiError(reply, request, 400, "ReasonRequired");
        throw e;
      }
    }
  );
}
