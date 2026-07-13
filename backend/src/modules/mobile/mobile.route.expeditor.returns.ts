import type { FastifyInstance } from "fastify";
import {
  mobileExpeditorReturnByOrderBodySchema,
  mobileExpeditorReturnByOrderPreviewBodySchema
} from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableByDate } from "../../lib/document-edit-lock.request";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  createMobileExpeditorReturnByOrder,
  getMobileExpeditorReturnByOrderComposition,
  listMobileExpeditorReturnByOrderOrders,
  listMobileExpeditorReturns,
  previewMobileExpeditorReturnByOrder
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorReturnRoutes(app: FastifyInstance) {

  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/returns
  // Ekspeditor topshiradigan qaytarish hujjatlari + zavsklad qabul holati.
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/returns",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await listMobileExpeditorReturns(request.tenant!.id, userId);
      return reply.send(data);
    }
  );

  // GET /api/:slug/mobile/expeditor/return-by-order/orders
  //   «Возврат с полки по заказу» — tanlanadigan zakazlar (balans/davr filtri)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/return-by-order/orders",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await listMobileExpeditorReturnByOrderOrders(request.tenant!.id, userId);
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "RETURN_DISABLED") {
          return sendApiError(reply, request, 403, "ReturnDisabled");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/orders/:id/return-by-order/composition
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/orders/:id/return-by-order/composition",
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
        const row = await getMobileExpeditorReturnByOrderComposition(
          request.tenant!.id,
          userId,
          idParsed.data.id
        );
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "RETURN_DISABLED") {
          return sendApiError(reply, request, 403, "ReturnDisabled");
        }
        if (
          e instanceof Error &&
          [
            "BAD_STATUS",
            "BAD_ORDER",
            "RETURN_FILTER_EMPTY",
            "RETURN_ORDER_OUT_OF_FILTER",
            "ORDER_NOT_DELIVERED",
            "ORDER_FULLY_RETURNED"
          ].includes(e.message)
        ) {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/expeditor/orders/:id/return-by-order
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/expeditor/orders/:id/return-by-order",
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
      const bodyParsed = mobileExpeditorReturnByOrderBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        await assertDocWritableByDate(request, "returns", new Date());
        const row = await createMobileExpeditorReturnByOrder(
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
        if (
          e instanceof Error &&
          [
            "BAD_STATUS",
            "BAD_ORDER",
            "BAD_CLIENT",
            "BAD_PRODUCT",
            "EMPTY_LINES",
            "RETURN_FILTER_EMPTY",
            "RETURN_ORDER_OUT_OF_FILTER",
            "ORDER_NOT_DELIVERED",
            "ORDER_FULLY_RETURNED",
            "RETURN_QTY_EXCEEDS_ORDERED",
            "REFUND_EXCEEDS_ORDER_REMAINING",
            "MIXED_LINE_MODES",
            "MIXED_LINE_FIELDS",
            "EMPTY_LINE",
            "BONUS_CASH_EXCEEDS",
            "NOTHING_TO_RETURN",
            "RETURN_NOT_INTERCHANGEABLE"
          ].includes(e.message)
        ) {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/expeditor/orders/:id/return-by-order/preview
  // Tizimning bonus mexanizmi bo'yicha oldindan hisoblash (bonus kamchiligi).
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/expeditor/orders/:id/return-by-order/preview",
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
      const bodyParsed = mobileExpeditorReturnByOrderPreviewBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await previewMobileExpeditorReturnByOrder(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data.lines
        );
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "RETURN_DISABLED") {
          return sendApiError(reply, request, 403, "ReturnDisabled");
        }
        if (
          e instanceof Error &&
          [
            "BAD_STATUS",
            "BAD_ORDER",
            "BAD_CLIENT",
            "RETURN_FILTER_EMPTY",
            "RETURN_ORDER_OUT_OF_FILTER",
            "ORDER_NOT_DELIVERED",
            "ORDER_FULLY_RETURNED"
          ].includes(e.message)
        ) {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        throw e;
      }
    }
  );
}
