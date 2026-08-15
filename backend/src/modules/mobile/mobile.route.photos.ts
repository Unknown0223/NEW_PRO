import type { FastifyInstance } from "fastify";
import {
  mobileClientPhotoBodySchema,
  mobileClientPhotoLinkBodySchema
} from "../../contracts/mobile.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { CLIENT_PHOTO_HTTP_BODY_LIMIT_BYTES } from "../../lib/client-photo-limits";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getClientPhotoReportById, listClientPhotoReports } from "../clients/client-assets.service";
import {
  createMobileClientPhotoReport,
  createMobileExpeditorClientPhotoReport,
  deleteMobileClientPhotoReport,
  deleteMobileExpeditorClientPhotoReport,
  linkMobileClientPhotoToOrder
} from "./mobile.service";
import {
  isAgentOrExpeditorRole,
  mobileAgentConfigPreHandler,
  mobilePhotoReportListOpts,
  parseClientPhotoPathParams
} from "./mobile.route.shared";

export async function registerMobilePhotoRoutes(app: FastifyInstance) {
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
    { preHandler: [...mobileAgentConfigPreHandler], bodyLimit: CLIENT_PHOTO_HTTP_BODY_LIMIT_BYTES },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!isAgentOrExpeditorRole(viewer.role)) {
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
      const ids = parseClientPhotoPathParams(params);
      if (!ids.ok) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const row = await getClientPhotoReportById(request.tenant!.id, ids.clientId, ids.photoId, {
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
      if (!isAgentOrExpeditorRole(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const params = request.params as { id?: string; photoId?: string };
      const ids = parseClientPhotoPathParams(params);
      if (!ids.ok) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        if (viewer.role === "expeditor") {
          await deleteMobileExpeditorClientPhotoReport(
            request.tenant!.id,
            ids.clientId,
            ids.photoId,
            actorUserIdOrNull(request)
          );
        } else {
          await deleteMobileClientPhotoReport(request.tenant!.id, userId, ids.clientId, ids.photoId);
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
      const ids = parseClientPhotoPathParams(params);
      if (!ids.ok) {
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
          ids.clientId,
          ids.photoId,
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
}
