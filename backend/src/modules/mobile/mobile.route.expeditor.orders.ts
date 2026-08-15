import type { FastifyInstance } from "fastify";
import {
  mobileExpeditorPartialReturnBodySchema,
  mobileExpeditorPaymentBodySchema,
  mobileExpeditorReloadBodySchema
} from "../../contracts/mobile.schemas";
import { patchOrderStatusBodySchema } from "../../contracts/orders.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableById } from "../../lib/document-edit-lock.request";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  createMobileExpeditorOrderPayment,
  createMobileExpeditorPartialReturn,
  createMobileExpeditorReloadFromVehicle,
  getMobileExpeditorOrderDetail,
  getMobileExpeditorPaymentContext,
  patchMobileExpeditorOrderStatus
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorOrderRoutes(app: FastifyInstance) {

  // -----------------------------------------------------------------------
  // PATCH /api/:slug/mobile/expeditor/orders/:id/status
  // -----------------------------------------------------------------------
  app.patch(
    "/api/:slug/mobile/expeditor/orders/:id/status",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const statusParsed = patchOrderStatusBodySchema.safeParse(request.body ?? {});
      if (!statusParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(statusParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        await assertDocWritableById(request, "orders", idParsed.data.id);
        const row = await patchMobileExpeditorOrderStatus(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          statusParsed.data.status,
          statusParsed.data.reason ?? null
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "INVALID_STATUS") {
          return sendApiError(reply, request, 400, "InvalidStatus");
        }
        if (e instanceof Error && e.message === "INVALID_TRANSITION") {
          return sendApiError(reply, request, 400, "InvalidTransition");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/orders/:id
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/orders/:id",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await getMobileExpeditorOrderDetail(
          request.tenant!.id,
          userId,
          idParsed.data.id
        );
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/orders/:id/payment-context
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/orders/:id/payment-context",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await getMobileExpeditorPaymentContext(
          request.tenant!.id,
          userId,
          idParsed.data.id
        );
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "PAYMENT_DISABLED") {
          return sendApiError(reply, request, 403, "PaymentDisabled");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/expeditor/orders/:id/payments
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/expeditor/orders/:id/payments",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const bodyParsed = mobileExpeditorPaymentBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await createMobileExpeditorOrderPayment(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "PAYMENT_DISABLED") {
          return sendApiError(reply, request, 403, "PaymentDisabled");
        }
        if (e instanceof Error && (e.message === "BAD_PAYMENT_TYPE" || e.message === "BAD_AMOUNT")) {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/expeditor/orders/:id/partial-return
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/expeditor/orders/:id/partial-return",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const bodyParsed = mobileExpeditorPartialReturnBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        await assertDocWritableById(request, "orders", idParsed.data.id);
        const row = await createMobileExpeditorPartialReturn(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "RETURN_DISABLED") {
          return sendApiError(reply, request, 403, "ReturnDisabled");
        }
        if (e instanceof Error && (e.message === "BAD_STATUS" || e.message === "BAD_REASON")) {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        if (e instanceof Error && e.message === "INVALID_TRANSITION") {
          return sendApiError(reply, request, 400, "InvalidTransition");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/expeditor/orders/:id/reload-from-vehicle
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/expeditor/orders/:id/reload-from-vehicle",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const bodyParsed = mobileExpeditorReloadBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        await assertDocWritableById(request, "orders", idParsed.data.id);
        const row = await createMobileExpeditorReloadFromVehicle(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "RELOAD_DISABLED") {
          return sendApiError(reply, request, 403, "ReloadDisabled");
        }
        if (e instanceof Error && e.message === "BAD_STATUS") {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        if (e instanceof Error && e.message === "INVALID_TRANSITION") {
          return sendApiError(reply, request, 400, "InvalidTransition");
        }
        throw e;
      }
    }
  );
}
