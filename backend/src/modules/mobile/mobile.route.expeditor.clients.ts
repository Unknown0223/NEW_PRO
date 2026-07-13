import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  getMobileExpeditorClientBalanceDetail,
  getMobileExpeditorClientDetail,
  getMobileExpeditorClientLedger,
  listMobileExpeditorClientOrders
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorClientRoutes(app: FastifyInstance) {

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
}
