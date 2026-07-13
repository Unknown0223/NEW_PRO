import type { FastifyInstance } from "fastify";
import {
  mobilePresenceBodySchema,
  mobileRegisterFcmBodySchema,
  mobileSyncDeltaBodySchema,
  mobileSyncFullBodySchema
} from "../../contracts/mobile.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { registerFcmToken, reportMobilePresence, syncDelta, syncFull } from "./mobile.service";
import { isExpeditorRole, mobileSyncPreHandler, parseDateLike } from "./mobile.route.shared";

export async function registerMobileSyncRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/presence  — qurilma / APK (web panel)
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/presence",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobilePresenceBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      const at = await reportMobilePresence(userId, {
        device_name: parsed.data.device_name,
        user_agent: parsed.data.user_agent,
        apk_version: parsed.data.apk_version
      });
      return reply.send({ ok: true, reported_at: at.toISOString() });
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/sync/full  — full data sync
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/sync/full",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (isExpeditorRole(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = mobileSyncFullBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const lastSyncAt = parseDateLike(parsed.data.last_sync_at);
      if (lastSyncAt === undefined) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid date format", {
          field: "last_sync_at"
        });
      }
      const userId = Number(getAccessUser(request).sub);

      try {
        const result = await syncFull(request.tenant!.id, userId, lastSyncAt, {
          device_name: parsed.data.device_name,
          user_agent: parsed.data.user_agent,
          apk_version: parsed.data.apk_version,
          forceClientsCatalog: parsed.data.force_clients_catalog === true
        });
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.startsWith("SYNC_NOT_ALLOWED:")) {
          return sendApiError(reply, request, 403, "SyncNotAllowed", msg.slice("SYNC_NOT_ALLOWED:".length));
        }
        throw e;
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/sync/delta  — delta sync for single entity
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/sync/delta",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (isExpeditorRole(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = mobileSyncDeltaBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const lastSyncAt = parseDateLike(parsed.data.last_sync_at);
      if (lastSyncAt === undefined) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid date format", {
          field: "last_sync_at"
        });
      }
      const entityType = parsed.data.entity_type;
      const userId = Number(getAccessUser(request).sub);

      try {
        const result = await syncDelta(request.tenant!.id, userId, lastSyncAt, entityType, {
          device_name: parsed.data.device_name,
          user_agent: parsed.data.user_agent,
          apk_version: parsed.data.apk_version
        });
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.startsWith("SYNC_NOT_ALLOWED:")) {
          return sendApiError(reply, request, 403, "SyncNotAllowed", msg.slice("SYNC_NOT_ALLOWED:".length));
        }
        throw e;
      }
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/fcm/register  — register FCM device token
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/fcm/register",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileRegisterFcmBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      const token = parsed.data.token;
      const deviceType = parsed.data.device_type ?? "android";

      const result = await registerFcmToken(request.tenant!.id, userId, token, deviceType);
      return reply.send(result);
    },
  );
}
