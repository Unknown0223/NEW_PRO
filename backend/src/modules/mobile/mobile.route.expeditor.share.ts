import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ShareError } from "./share/share-codes";
import {
  acceptShareRequest,
  cancelShareRequest,
  createShareRequest,
  getShareRequest,
  listShareRequests,
  rejectShareRequest,
  upsertShareHandoff
} from "./share/share.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

const createBodySchema = z.object({
  order_ids: z.array(z.number().int().positive()).min(1),
  receiver_user_id: z.number().int().positive()
});

const acceptBodySchema = z.object({
  order_ids: z.array(z.number().int().positive()).default([])
});

const handoffBodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  photo_key: z.string().min(1)
});

function shareHttp(e: unknown): { status: number; code: string } | null {
  if (e instanceof ShareError) {
    if (e.code === "NOT_FOUND") return { status: 404, code: "NotFound" };
    return { status: 403, code: e.code };
  }
  return null;
}

export async function registerMobileExpeditorShareRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/mobile/expeditor/share",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const body = createBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(body.error)
        );
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await createShareRequest({
          tenantId: request.tenant!.id,
          senderUserId: userId,
          receiverUserId: body.data.receiver_user_id,
          orderIds: body.data.order_ids
        });
        return reply.code(201).send({ data: row });
      } catch (e) {
        const mapped = shareHttp(e);
        if (mapped) {
          return sendApiError(reply, request, mapped.status, mapped.code);
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/mobile/expeditor/share",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const q = z
        .object({ box: z.enum(["inbox", "outbox"]).default("inbox") })
        .safeParse(request.query ?? {});
      if (!q.success) {
        return sendApiError(reply, request, 400, "ValidationError");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const rows = await listShareRequests({
        tenantId: request.tenant!.id,
        userId,
        box: q.data.box
      });
      return reply.send({ data: rows });
    }
  );

  app.get(
    "/api/:slug/mobile/expeditor/share/:id",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await getShareRequest({
          tenantId: request.tenant!.id,
          userId,
          requestId: id
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = shareHttp(e);
        if (mapped) {
          return sendApiError(reply, request, mapped.status, mapped.code);
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/expeditor/share/:id/cancel",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await cancelShareRequest({
          tenantId: request.tenant!.id,
          userId,
          requestId: id
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = shareHttp(e);
        if (mapped) {
          return sendApiError(reply, request, mapped.status, mapped.code);
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/expeditor/share/:id/accept",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const body = acceptBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(body.error)
        );
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await acceptShareRequest({
          tenantId: request.tenant!.id,
          userId,
          requestId: id,
          acceptedOrderIds: body.data.order_ids
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = shareHttp(e);
        if (mapped) {
          return sendApiError(reply, request, mapped.status, mapped.code);
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/expeditor/share/:id/reject",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await rejectShareRequest({
          tenantId: request.tenant!.id,
          userId,
          requestId: id
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = shareHttp(e);
        if (mapped) {
          return sendApiError(reply, request, mapped.status, mapped.code);
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/expeditor/share/:id/handoff",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const body = handoffBodySchema.safeParse(request.body ?? {});
      if (!body.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(body.error)
        );
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await upsertShareHandoff({
          tenantId: request.tenant!.id,
          userId,
          requestId: id,
          lat: body.data.lat,
          lng: body.data.lng,
          photoKey: body.data.photo_key
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = shareHttp(e);
        if (mapped) {
          return sendApiError(reply, request, mapped.status, mapped.code);
        }
        throw e;
      }
    }
  );
}