import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import { mergeClientsIntoOne, previewMergeClients } from "./clients.service";
import {
  createSavedDuplicateGroup,
  deleteSavedDuplicateGroup,
  listClientMergeHistory,
  listMergeSessionsForTenant,
  listSavedDuplicateGroups
} from "./client-dedupe.service";
import { mergeBodySchema, savedDupGroupBodySchema } from "./clients.route.schemas";

export async function registerClientDedupeRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/clients/merge-sessions",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "10", 10) || 10));
      const result = await listMergeSessionsForTenant(request.tenant!.id, page, limit, q.search);
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/clients/saved-duplicate-groups",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const rows = await listSavedDuplicateGroups(request.tenant!.id);
      return reply.send({ data: rows });
    }
  );

  app.post(
    "/api/:slug/clients/saved-duplicate-groups",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = savedDupGroupBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const actor = getAccessUser(request);
        const sub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const row = await createSavedDuplicateGroup(request.tenant!.id, parsed.data, actorUserId);
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "TOO_FEW_CLIENTS" || msg === "MASTER_NOT_IN_SET") {
          return sendApiError(reply, request, 400, "ValidationError");
        }
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/clients/saved-duplicate-groups/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id)) return sendApiError(reply, request, 400, "ValidationError");
      try {
        await deleteSavedDuplicateGroup(request.tenant!.id, id);
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/merge-history",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
      const result = await listClientMergeHistory(request.tenant!.id, page, limit);
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/clients/merge-preview",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mergeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const result = await previewMergeClients(
          request.tenant!.id,
          parsed.data.keep_client_id,
          parsed.data.merge_client_ids
        );
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ALREADY_MERGED") return sendApiError(reply, request, 409, "AlreadyMerged");
        if (msg === "NO_MERGE_TARGETS") return sendApiError(reply, request, 400, "NoMergeTargets");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/clients/merge",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mergeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const actor = getAccessUser(request);
        const sub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const result = await mergeClientsIntoOne(
          request.tenant!.id,
          parsed.data.keep_client_id,
          parsed.data.merge_client_ids,
          actorUserId
        );
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ALREADY_MERGED") return sendApiError(reply, request, 409, "AlreadyMerged");
        if (msg === "NO_MERGE_TARGETS") return sendApiError(reply, request, 400, "NoMergeTargets");
        throw e;
      }
    }
  );
}
