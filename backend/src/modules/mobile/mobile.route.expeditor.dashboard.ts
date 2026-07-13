import type { FastifyInstance } from "fastify";
import { mobileExpeditorClientLocationBodySchema } from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  getMobileExpeditorDashboard,
  listMobileExpeditorDebtors,
  listMobileExpeditorReturnedPayments,
  listMobileExpeditorVisits,
  patchMobileExpeditorClientLocation
} from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorDashboardRoutes(app: FastifyInstance) {

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
}
