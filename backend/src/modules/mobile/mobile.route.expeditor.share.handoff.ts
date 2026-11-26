import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { ShareError } from "./share/share-codes";
import { upsertShareHandoff } from "./share/share.service";
import { uploadShareHandoffPhoto } from "./share/share-handoff-photo.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

const handoffBodySchema = z.object({
  lat: z.number(),
  lng: z.number(),
  photo_key: z.string().min(1)
});

const handoffPhotoBodySchema = z.object({
  image_base64: z.string().min(32)
});

function shareHttp(e: unknown): { status: number; code: string } | null {
  if (e instanceof ShareError) {
    if (e.code === "NOT_FOUND") return { status: 404, code: "NotFound" };
    return { status: 403, code: e.code };
  }
  return null;
}

export function registerMobileExpeditorShareHandoffRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/mobile/expeditor/share/:id/handoff-photo",
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
      const body = handoffPhotoBodySchema.safeParse(request.body ?? {});
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
        const put = await uploadShareHandoffPhoto({
          tenantId: request.tenant!.id,
          userId,
          requestId: id,
          imageBase64: body.data.image_base64
        });
        return reply.send({ data: put });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "IMAGE_TOO_LARGE" || msg === "INVALID_IMAGE") {
          return sendApiError(reply, request, 400, msg);
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
      if (body.data.photo_key.startsWith("capture:")) {
        return sendApiError(
          reply,
          request,
          400,
          "SHARE_PHOTO_UPLOAD_REQUIRED",
          "Avval handoff-photo orqali yuklang"
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
