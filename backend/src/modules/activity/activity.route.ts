import type { FastifyInstance } from "fastify";
import { env } from "../../config/env";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { resolveUserPermissionKeys } from "../access/rbac.service";
import { resolveEntityHistory } from "./activity.constants";
import {
  activityMeta,
  entityHistoryTimeline,
  ingestActivityEvents,
  listActivityEvents,
  type RawActivityEvent
} from "./activity.service";

const adminRoles = ["admin"] as const;

export async function registerActivityRoutes(app: FastifyInstance) {
  // ── Ingestion: foydalanuvchi xatti-harakatlari (page-view, niyatlar) ──
  app.post(
    "/api/:slug/activity/track",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      if (env.ACTIVITY_TRACKING_ENABLED !== "1") {
        return reply.send({ accepted: 0, rejected: 0, disabled: true });
      }
      const body = request.body as { events?: RawActivityEvent[] } | RawActivityEvent[] | undefined;
      const events = Array.isArray(body) ? body : (body?.events ?? []);
      const result = await ingestActivityEvents(
        request.tenant!.id,
        actorUserIdOrNull(request),
        events
      );
      return reply.send(result);
    }
  );

  // ── Admin global feed ──
  app.get(
    "/api/:slug/activity",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
      const actorRaw = q.actor_user_id?.trim();
      const actor = actorRaw ? Number.parseInt(actorRaw, 10) : undefined;
      const result = await listActivityEvents(request.tenant!.id, {
        actor_user_id: Number.isFinite(actor) ? actor : undefined,
        module: q.module,
        section: q.section,
        event_type: q.event_type,
        entity_type: q.entity_type,
        entity_id: q.entity_id,
        search: q.search,
        from: q.from,
        to: q.to,
        page,
        limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/activity/meta",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      return reply.send(await activityMeta(request.tenant!.id));
    }
  );

  // ── Birlashtirilgan per-entity tarix (sahifa ichidagi tarix ikonkasi) ──
  app.get(
    "/api/:slug/history/:entityType/:entityId",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { entityType, entityId } = request.params as { entityType: string; entityId: string };
      const descriptor = resolveEntityHistory(entityType);
      if (!descriptor) {
        return sendApiError(reply, request, 404, "UnknownEntityType", undefined, { entityType });
      }

      // Ruxsat: admin chetlab o'tadi; aks holda `<module>.<section>.history` yoki `.view`.
      const user = getAccessUser(request);
      if (user.role !== "admin") {
        const userId = Number(user.sub);
        if (!Number.isInteger(userId) || userId < 1) {
          return sendApiError(reply, request, 401, "InvalidAccessUser");
        }
        const keys = await resolveUserPermissionKeys(user.tenantId, userId, user.role);
        if (!keys.has(descriptor.permissionHistory) && !keys.has(descriptor.permissionView)) {
          return sendApiError(reply, request, 403, "ForbiddenPermission", undefined, {
            permissions: [descriptor.permissionHistory, descriptor.permissionView]
          });
        }
      }

      const q = request.query as Record<string, string | undefined>;
      const limit = Math.min(500, Math.max(1, Number.parseInt(q.limit ?? "200", 10) || 200));
      const result = await entityHistoryTimeline(request.tenant!.id, entityType, entityId, limit);
      if (!result) {
        return sendApiError(reply, request, 404, "UnknownEntityType", undefined, { entityType });
      }
      return reply.send(result);
    }
  );
}
