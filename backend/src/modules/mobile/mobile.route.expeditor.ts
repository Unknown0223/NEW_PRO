import type { FastifyInstance } from "fastify";
import {
  mobileExpeditorClientLocationBodySchema,
  mobileExpeditorPartialReturnBodySchema,
  mobileExpeditorPaymentBodySchema,
  mobileExpeditorReloadBodySchema,
  mobileExpeditorReturnByOrderBodySchema,
  mobileExpeditorReturnByOrderPreviewBodySchema
} from "../../contracts/mobile.schemas";
import { patchOrderStatusBodySchema } from "../../contracts/orders.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  createMobileExpeditorOrderPayment,
  createMobileExpeditorPartialReturn,
  createMobileExpeditorReloadFromVehicle,
  createMobileExpeditorReturnByOrder,
  getMobileExpeditorOrderDetail,
  getMobileExpeditorPaymentContext,
  getMobileExpeditorReturnByOrderComposition,
  listMobileExpeditorDeliveries,
  listMobileExpeditorReturnByOrderOrders,
  listMobileExpeditorReturns,
  patchMobileExpeditorClientLocation,
  patchMobileExpeditorOrderStatus,
  previewMobileExpeditorReturnByOrder
} from "./mobile.expeditor.service";
import {
  confirmMobileExpeditorShipmentDocument,
  getMobileExpeditorClientBalanceDetail,
  getMobileExpeditorClientDetail,
  getMobileExpeditorClientLedger,
  getMobileExpeditorDashboard,
  getMobileExpeditorShipmentDocumentDetail,
  getMobileExpeditorVehicleStock,
  listMobileExpeditorClientOrders,
  listMobileExpeditorDebtors,
  listMobileExpeditorPayments,
  listMobileExpeditorReturnedPayments,
  listMobileExpeditorShipmentDocuments,
  listMobileExpeditorVisits,
  listMobileExpeditorWarehouses
} from "./mobile.expeditor.workflow.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/expeditor/deliveries",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const q = request.query as { page?: string; limit?: string; status?: string };
      const data = await listMobileExpeditorDeliveries(request.tenant!.id, userId, {
        page: Number.parseInt(q.page ?? "1", 10) || 1,
        limit: Number.parseInt(q.limit ?? "50", 10) || 50,
        status: q.status?.trim() || undefined
      });
      return reply.send(data);
    }
  );

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
        const row = await patchMobileExpeditorOrderStatus(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          statusParsed.data.status,
          statusParsed.data.reason ?? null
        );
        return reply.send(row);
      } catch (e) {
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
        const row = await createMobileExpeditorPartialReturn(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
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
        const row = await createMobileExpeditorReloadFromVehicle(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
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
        const row = await createMobileExpeditorReturnByOrder(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
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

  // -----------------------------------------------------------------------
  // PATCH /api/:slug/mobile/expeditor/clients/:id/location
  // -----------------------------------------------------------------------
  app.patch(
    "/api/:slug/mobile/expeditor/clients/:id/location",
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
      const bodyParsed = mobileExpeditorClientLocationBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await patchMobileExpeditorClientLocation(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "LOCATION_FORBIDDEN") {
          return sendApiError(reply, request, 403, "LocationForbidden");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/dashboard
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/dashboard",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await getMobileExpeditorDashboard(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/visits?tab=active|completed|routes
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/visits",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const tab = (request.query as { tab?: string }).tab?.trim() || "active";
      const safeTab =
        tab === "completed" || tab === "routes" || tab === "unfinished" ? tab : "active";
      const data = await listMobileExpeditorVisits(request.tenant!.id, userId, safeTab);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/debtors
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/debtors",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await listMobileExpeditorDebtors(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/returned-payments — kassir qaytargan (taymerli)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/returned-payments",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await listMobileExpeditorReturnedPayments(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/client/:clientId/balance-detail
  // -----------------------------------------------------------------------
  app.get<{ Params: { slug: string; clientId: string } }>(
    "/api/:slug/mobile/expeditor/client/:clientId/balance-detail",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const clientId = Number.parseInt(request.params.clientId, 10);
      if (!Number.isFinite(clientId) || clientId <= 0) {
        return sendApiError(reply, request, 400, "InvalidClientId");
      }
      const data = await getMobileExpeditorClientBalanceDetail(request.tenant!.id, userId, clientId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/client/:clientId/detail
  // Mijoz kartasi: sarlavha + to'lov tarixi (Оплата) + qaytarilgan zakazlar.
  // Ekspeditor "Должники" → mijoz kartochkasi bosilganda chaqiriladi.
  // -----------------------------------------------------------------------
  app.get<{ Params: { slug: string; clientId: string } }>(
    "/api/:slug/mobile/expeditor/client/:clientId/detail",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const clientId = Number.parseInt(request.params.clientId, 10);
      if (!Number.isFinite(clientId) || clientId <= 0) {
        return sendApiError(reply, request, 400, "InvalidClientId");
      }
      const data = await getMobileExpeditorClientDetail(request.tenant!.id, userId, clientId);
      if (!data) return sendApiError(reply, request, 404, "ClientNotFound");
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/client/:clientId/orders — История заказов
  // -----------------------------------------------------------------------
  app.get<{ Params: { slug: string; clientId: string } }>(
    "/api/:slug/mobile/expeditor/client/:clientId/orders",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const clientId = Number.parseInt(request.params.clientId, 10);
      if (!Number.isFinite(clientId) || clientId <= 0) {
        return sendApiError(reply, request, 400, "InvalidClientId");
      }
      const q = request.query as { date_from?: string; date_to?: string };
      const from = q.date_from ? new Date(q.date_from) : null;
      const to = q.date_to ? new Date(q.date_to) : null;
      const data = await listMobileExpeditorClientOrders(request.tenant!.id, userId, clientId, {
        from: from && !Number.isNaN(from.getTime()) ? from : null,
        to: to && !Number.isNaN(to.getTime()) ? to : null
      });
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/client/:clientId/ledger — Акт сверки
  // -----------------------------------------------------------------------
  app.get<{ Params: { slug: string; clientId: string } }>(
    "/api/:slug/mobile/expeditor/client/:clientId/ledger",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const clientId = Number.parseInt(request.params.clientId, 10);
      if (!Number.isFinite(clientId) || clientId <= 0) {
        return sendApiError(reply, request, 400, "InvalidClientId");
      }
      const q = request.query as { date_from?: string; date_to?: string; page?: string; kind?: string };
      const from = q.date_from ? new Date(q.date_from) : null;
      const to = q.date_to ? new Date(q.date_to) : null;
      const page = q.page ? Number.parseInt(q.page, 10) : 1;
      const kind = q.kind === "debt" || q.kind === "payment" ? q.kind : "all";
      const data = await getMobileExpeditorClientLedger(request.tenant!.id, userId, clientId, {
        from: from && !Number.isNaN(from.getTime()) ? from : null,
        to: to && !Number.isNaN(to.getTime()) ? to : null,
        page: Number.isFinite(page) && page > 0 ? page : 1,
        kind
      });
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/payments-summary?group_by=list|clients
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/payments-summary",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const gb = (request.query as { group_by?: string }).group_by?.trim();
      const groupBy = gb === "clients" ? "clients" : "list";
      const data = await listMobileExpeditorPayments(request.tenant!.id, userId, groupBy);
      return reply.send(data);
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/shipment-documents?type=shipping|return
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/shipment-documents",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const t = (request.query as { type?: string }).type?.trim();
      const docType = t === "return" ? "return" : "shipping";
      const data = await listMobileExpeditorShipmentDocuments(request.tenant!.id, userId, docType);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/shipment-documents/:docId
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/shipment-documents/:docId",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const docId = String((request.params as { docId?: string }).docId ?? "").trim();
      if (!docId) return sendApiError(reply, request, 400, "InvalidId");
      try {
        const data = await getMobileExpeditorShipmentDocumentDetail(request.tenant!.id, userId, docId);
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/expeditor/shipment-documents/:docId/confirm
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/expeditor/shipment-documents/:docId/confirm",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const docId = String((request.params as { docId?: string }).docId ?? "").trim();
      if (!docId) return sendApiError(reply, request, 400, "InvalidId");
      try {
        const data = await confirmMobileExpeditorShipmentDocument(request.tenant!.id, userId, docId);
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && (e.message === "ALREADY_CONFIRMED" || e.message === "BAD_DOC_TYPE")) {
          return sendApiError(reply, request, 400, "ValidationError", e.message);
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/warehouses
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/warehouses",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await listMobileExpeditorWarehouses(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/expeditor/vehicle-stock
  // Mashinadagi qoldiq — skladdan olingan, hali yetkazilmagan mahsulotlar.
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/expeditor/vehicle-stock",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") return sendApiError(reply, request, 403, "ForbiddenRole");
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await getMobileExpeditorVehicleStock(request.tenant!.id, userId);
      return reply.send(data);
    }
  );
}
