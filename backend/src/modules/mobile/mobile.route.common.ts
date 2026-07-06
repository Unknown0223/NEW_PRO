import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  mobileChangePasswordBodySchema,
  mobileClientPhotoBodySchema,
  mobileClientPhotoLinkBodySchema,
  mobilePatchProfileBodySchema,
  mobilePresenceBodySchema,
  mobileRegisterFcmBodySchema,
  mobileSyncDeltaBodySchema,
  mobileSyncFullBodySchema
} from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import {
  createOrderCashInBodySchema,
  orderCashInContextQuerySchema
} from "../../contracts/payments.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { bindQrByCode, unbindQrByCode } from "../client-qr/client-qr.write";
import { getClientPhotoReportById, listClientPhotoReports } from "../clients/client-assets.service";
import {
  createOrderCashInBatch,
  getOrderCashInContext
} from "../payments/payment.order-cash-in";
import {
  changeMobileMePassword,
  getMobileMeProfile,
  patchMobileMeProfile
} from "./mobile-profile.service";
import { recordMobileStockSnapshot } from "./mobile-order-policy";
import {
  createMobileClientPhotoReport,
  createMobileExpeditorClientPhotoReport,
  deleteMobileClientPhotoReport,
  deleteMobileExpeditorClientPhotoReport,
  linkMobileClientPhotoToOrder,
  registerFcmToken,
  reportMobilePresence,
  syncDelta,
  syncFull
} from "./mobile.service";
import {
  mobileAgentConfigPreHandler,
  mobileJwtRoles,
  mobileOfflineOrderPreHandler,
  mobilePhotoReportListOpts,
  mobileSyncPreHandler,
  parseDateLike
} from "./mobile.route.shared";

export async function registerMobileCommonRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/me/profile",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      try {
        return reply.send(await getMobileMeProfile(request.tenant!.id, userId));
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/mobile/me/profile",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobilePatchProfileBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      try {
        return reply.send(await patchMobileMeProfile(request.tenant!.id, userId, parsed.data));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "AVATAR_TOO_LARGE") {
          return sendApiError(reply, request, 400, "ValidationError", "Rasm juda katta");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/me/change-password",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileChangePasswordBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      try {
        await changeMobileMePassword(request.tenant!.id, userId, parsed.data);
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "INVALID_OLD_PASSWORD") {
          return sendApiError(reply, request, 400, "ValidationError", "Eski parol noto'g'ri");
        }
        throw e;
      }
    }
  );

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
      if (viewer.role === "expeditor") {
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
  // POST /api/:slug/mobile/sync/delta  — delta sync for single entity
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/sync/delta",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role === "expeditor") {
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

  app.get(
    "/api/:slug/mobile/clients/:id/photo-reports",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const viewer = getAccessUser(request);
      try {
        const q = request.query as Record<string, string | undefined>;
        const includeImages =
          q.include_images === "1" || q.include_images === "true" || q.includeImages === "true";
        const data = await listClientPhotoReports(request.tenant!.id, parsed.data.id, {
          includeImages,
          ...mobilePhotoReportListOpts(viewer)
        });
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "CLIENT_NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/clients/:id/photo-reports",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent" && viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const bodyParsed = mobileClientPhotoBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row =
          viewer.role === "expeditor"
              ? await createMobileExpeditorClientPhotoReport(
                  request.tenant!.id,
                  userId,
                  idParsed.data.id,
                  bodyParsed.data
                )
              : await createMobileClientPhotoReport(
                  request.tenant!.id,
                  userId,
                  idParsed.data.id,
                  bodyParsed.data
                );
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "CLIENT_NOT_FOUND" || msg === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/mobile/clients/:id/photo-reports/:photoId",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      const params = request.params as { id?: string; photoId?: string };
      const clientId = Number.parseInt(params.id ?? "", 10);
      const photoId = Number.parseInt(params.photoId ?? "", 10);
      if (!Number.isFinite(clientId) || clientId < 1 || !Number.isFinite(photoId) || photoId < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const row = await getClientPhotoReportById(request.tenant!.id, clientId, photoId, {
          ...mobilePhotoReportListOpts(viewer)
        });
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/mobile/clients/:id/photo-reports/:photoId",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent" && viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const params = request.params as { id?: string; photoId?: string };
      const clientId = Number.parseInt(params.id ?? "", 10);
      const photoId = Number.parseInt(params.photoId ?? "", 10);
      if (!Number.isFinite(clientId) || clientId < 1 || !Number.isFinite(photoId) || photoId < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        if (viewer.role === "expeditor") {
          await deleteMobileExpeditorClientPhotoReport(request.tenant!.id, clientId, photoId);
        } else {
          await deleteMobileClientPhotoReport(request.tenant!.id, userId, clientId, photoId);
        }
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "CLIENT_NOT_FOUND" || msg === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/mobile/clients/:id/photo-reports/:photoId",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const params = request.params as { id?: string; photoId?: string };
      const clientId = Number.parseInt(params.id ?? "", 10);
      const photoId = Number.parseInt(params.photoId ?? "", 10);
      if (!Number.isFinite(clientId) || clientId < 1 || !Number.isFinite(photoId) || photoId < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const bodyParsed = mobileClientPhotoLinkBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await linkMobileClientPhotoToOrder(
          request.tenant!.id,
          userId,
          clientId,
          photoId,
          bodyParsed.data.order_id
        );
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "CLIENT_NOT_FOUND" || msg === "NOT_FOUND" || msg === "ORDER_NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // Van selling — order cash-in (agent)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/payments/order-cash-in/context",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = orderCashInContextQuerySchema.safeParse(request.query);
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
      const orderIdsRaw = parsed.data.order_ids?.trim();
      const order_ids = orderIdsRaw
        ? orderIdsRaw
            .split(/[,]+/)
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        : undefined;
      try {
        const data = await getOrderCashInContext(request.tenant!.id, {
          client_id: parsed.data.client_id,
          order_ids
        });
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/payments/order-cash-in",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createOrderCashInBodySchema.safeParse(request.body);
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
      try {
        const data = await createOrderCashInBatch(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (msg === "BAD_AMOUNT") return sendApiError(reply, request, 400, "BadAmount");
        if (msg === "BAD_PAYMENT_TYPE") return sendApiError(reply, request, 400, "BadPaymentType");
        if (msg === "NO_LINES") return sendApiError(reply, request, 400, "NoLines");
        if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 400, "BadCashDesk");
        throw e;
      }
    }
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

  const mobileQrBodySchema = z.object({
    qr_code: z.string().trim().min(1).max(128),
    client_id: z.number().int().positive().optional()
  });

  app.post(
    "/api/:slug/mobile/client-qr/bind",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileQrBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (parsed.data.client_id == null) {
        return sendApiError(reply, request, 400, "ValidationError");
      }
      try {
        await bindQrByCode({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          qrCode: parsed.data.qr_code,
          clientId: parsed.data.client_id
        });
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "CLIENT_ALREADY_HAS_QR") {
          return sendApiError(reply, request, 409, "ClientAlreadyHasQr");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/client-qr/unbind",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileQrBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await unbindQrByCode({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          qrCode: parsed.data.qr_code
        });
        return reply.send({ ok: true });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/stock-snapshot",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      if (!Number.isFinite(userId) || userId < 1) {
        return sendApiError(reply, request, 401, "Unauthorized");
      }
      await recordMobileStockSnapshot(request.tenant!.id, userId);
      return reply.send({ ok: true });
    }
  );
}
