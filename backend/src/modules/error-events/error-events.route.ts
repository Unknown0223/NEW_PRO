import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  errorEventsMeta,
  getErrorEventDetail,
  ingestMobileErrorEvent,
  listErrorEvents
} from "./error-events.service";

const adminRoles = ["admin"] as const;

const mobileIngestSchema = z.object({
  message: z.string().min(1).max(500),
  error_code: z.string().max(128).optional(),
  request_id: z.string().max(64).optional(),
  path: z.string().max(255).optional(),
  method: z.string().max(16).optional(),
  http_status: z.number().int().min(0).max(599).optional(),
  module: z.string().max(64).optional(),
  severity: z.enum(["error", "fatal"]).optional(),
  platform: z.enum(["android", "ios", "server"]).optional(),
  apk_version: z.string().max(64).optional(),
  device_name: z.string().max(128).optional(),
  device_id: z.string().max(128).optional(),
  occurred_at: z.string().max(40).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export async function registerErrorEventRoutes(app: FastifyInstance) {
  /** Mobil: o‘z xatosini yuborish (fire-and-forget client). */
  app.post(
    "/api/:slug/mobile/error-events",
    {
      preHandler: [jwtAccessVerify],
      ...writeApiRateLimitRouteOpts
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = actorUserIdOrNull(request);
      if (userId == null) {
        return sendApiError(reply, request, 401, "Unauthorized");
      }
      const parsed = mobileIngestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      const row = await ingestMobileErrorEvent(request.tenant!.id, userId, parsed.data);
      return reply.status(201).send({ ok: true, id: row?.id ?? null });
    }
  );

  app.get(
    "/api/:slug/error-events",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
      const userRaw = q.user_id?.trim();
      const userId = userRaw ? Number.parseInt(userRaw, 10) : undefined;
      const result = await listErrorEvents(request.tenant!.id, {
        user_id: Number.isFinite(userId) ? userId : undefined,
        source: q.source,
        module: q.module,
        search: q.search,
        from: q.from,
        to: q.to,
        request_id: q.request_id,
        page,
        limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/error-events/meta",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      return reply.send(await errorEventsMeta(request.tenant!.id));
    }
  );

  app.get(
    "/api/:slug/error-events/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const detail = await getErrorEventDetail(request.tenant!.id, id);
      if (!detail) return sendApiError(reply, request, 404, "NotFound");
      return reply.send(detail);
    }
  );
}

/** Admin check helper (tests). */
export function assertAdminForErrorLogs(request: Parameters<typeof getAccessUser>[0]) {
  return getAccessUser(request).role === "admin";
}
