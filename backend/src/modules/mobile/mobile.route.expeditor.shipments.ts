import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  confirmMobileExpeditorShipmentDocument,
  getMobileExpeditorShipmentDocumentDetail,
  getMobileExpeditorVehicleStock,
  listMobileExpeditorPayments,
  listMobileExpeditorShipmentDocuments,
  listMobileExpeditorWarehouses
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorShipmentRoutes(app: FastifyInstance) {

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
