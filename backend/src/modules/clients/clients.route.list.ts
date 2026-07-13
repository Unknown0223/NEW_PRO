import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import {
  bulkSetClientsActive,
  bulkPatchClients,
  exportClientsFilteredCsv,
  getClientReferences,
  listClientsForTenantPaged
} from "./clients.service";
import { listDuplicateCandidates } from "./client-dedupe.service";
import { bulkActiveBodySchema, bulkPatchBodySchema, parseClientListQuery } from "./clients.route.schemas";

export async function registerClientListRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/clients",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const result = await listClientsForTenantPaged(request.tenant!.id, parseClientListQuery(q));
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/clients/duplicate-candidates",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const tabRaw = (q.tab ?? "fields").toLowerCase();
      const tab = tabRaw === "geo" ? "geo" : "fields";
      const agent_id = q.agent_id != null ? Number.parseInt(q.agent_id, 10) : undefined;
      const geo_radius_m =
        q.geo_radius_m != null ? Number.parseInt(q.geo_radius_m, 10) : undefined;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "10", 10) || 10));
      const is_active =
        q.is_active === "yes" || q.is_active === "no"
          ? q.is_active
          : ("all" as const);
      const search_fields = (q.search_fields ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const client_type_codes = (q.client_type_codes ?? q.client_type_code ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await listDuplicateCandidates(request.tenant!.id, {
        tab,
        page,
        limit,
        agent_id: Number.isFinite(agent_id) ? agent_id : undefined,
        zone: q.zone,
        region: q.region,
        city: q.city,
        client_format: q.client_format,
        category: q.category,
        client_type_codes: client_type_codes.length > 0 ? client_type_codes : undefined,
        is_active,
        search: q.search,
        search_fields: search_fields.length > 0 ? search_fields : undefined,
        geo_radius_m: Number.isFinite(geo_radius_m) ? geo_radius_m : undefined
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/clients/references",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const refs = await getClientReferences(request.tenant!.id);
      return reply.send(refs);
    }
  );

  app.get(
    "/api/:slug/clients/export",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const listQ = parseClientListQuery(q);
      const { csv, truncated, totalMatched } = await exportClientsFilteredCsv(request.tenant!.id, listQ);
      reply
        .header("Content-Type", "text/csv; charset=utf-8")
        .header("Content-Disposition", 'attachment; filename="mijozlar.csv"')
        .header("X-Clients-Export-Truncated", truncated ? "1" : "0")
        .header("X-Clients-Export-Total", String(totalMatched));
      return reply.send(csv);
    }
  );

  app.patch(
    "/api/:slug/clients/bulk-active",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkActiveBodySchema.safeParse(request.body);
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
      const actor = getAccessUser(request);
      const sub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
      const result = await bulkSetClientsActive(
        request.tenant!.id,
        parsed.data.client_ids,
        parsed.data.is_active,
        actorUserId
      );
      return reply.send(result);
    }
  );

  app.patch(
    "/api/:slug/clients/bulk",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkPatchBodySchema.safeParse(request.body);
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
      const actor = getAccessUser(request);
      const sub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
      const result = await bulkPatchClients(
        request.tenant!.id,
        parsed.data.client_ids,
        parsed.data.patch,
        actorUserId
      );
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/clients/tags",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { listClientTags } = await import("./clients.tags");
      const data = await listClientTags(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/clients/tags",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { createClientTagBodySchema } = await import("./clients.route.schemas");
      const parsed = createClientTagBodySchema.safeParse(request.body);
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
        const { createClientTag } = await import("./clients.tags");
        const row = await createClientTag(request.tenant!.id, parsed.data.name);
        return reply.code(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "UNKNOWN";
        if (msg === "DUPLICATE") {
          return sendApiError(reply, request, 409, "DuplicateTag", "Tag already exists");
        }
        if (msg === "VALIDATION") {
          return sendApiError(reply, request, 400, "ValidationError", "Invalid tag name");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/clients/bulk-tags",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { bulkTagsBodySchema } = await import("./clients.route.schemas");
      const parsed = bulkTagsBodySchema.safeParse(request.body);
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
        const { bulkPatchClientTags } = await import("./clients.tags");
        const result = await bulkPatchClientTags(
          request.tenant!.id,
          parsed.data.client_ids,
          parsed.data.add_tag_ids,
          parsed.data.remove_tag_ids,
          actorUserId
        );
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "UNKNOWN";
        if (msg === "BAD_TAG") {
          return sendApiError(reply, request, 400, "BadTag", "One or more tags not found");
        }
        throw e;
      }
    }
  );
}
