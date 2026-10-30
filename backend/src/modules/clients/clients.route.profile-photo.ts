import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { CLIENT_PHOTO_HTTP_BODY_LIMIT_BYTES, CLIENT_PHOTO_MAX_IMAGE_URL_LEN } from "../../lib/client-photo-limits";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ensureAnyPermission } from "../access/ensure-any-permission";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  clearClientProfilePhoto,
  readClientProfilePhoto,
  setClientProfilePhoto
} from "./client-profile-photo.service";

const PROFILE_PHOTO_PERMISSION = "clients.profil.update";

const bodySchema = z.object({
  image_url: z.string().min(1).max(CLIENT_PHOTO_MAX_IMAGE_URL_LEN)
});

function clientIdOf(request: { params: unknown }): number {
  return Number.parseInt((request.params as { id?: string }).id ?? "", 10);
}

export async function registerClientProfilePhotoRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/clients/:id/profile-photo",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = clientIdOf(request);
      if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId");
      const photo = await readClientProfilePhoto(request.tenant!.id, id);
      if (!photo) return sendApiError(reply, request, 404, "NotFound");
      if ("redirect" in photo) return reply.redirect(photo.redirect);
      return reply
        .header("Cache-Control", "private, max-age=86400")
        .type(photo.contentType)
        .send(photo.buffer);
    }
  );

  app.put(
    "/api/:slug/clients/:id/profile-photo",
    {
      preHandler: [jwtAccessVerify],
      bodyLimit: CLIENT_PHOTO_HTTP_BODY_LIMIT_BYTES
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      if (!(await ensureAnyPermission(request, reply, [PROFILE_PHOTO_PERMISSION]))) return;
      const id = clientIdOf(request);
      if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId");
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Request validation failed", zodValidationExtras(parsed.error));
      }
      try {
        const row = await setClientProfilePhoto(request.tenant!.id, id, parsed.data.image_url);
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_IMAGE" || msg === "FILE_TOO_LARGE") {
          return sendApiError(reply, request, 400, "BadImage", "Нужно одно изображение клиента");
        }
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/clients/:id/profile-photo",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      if (!(await ensureAnyPermission(request, reply, [PROFILE_PHOTO_PERMISSION]))) return;
      const id = clientIdOf(request);
      if (!Number.isInteger(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId");
      try {
        const row = await clearClientProfilePhoto(request.tenant!.id, id);
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );
}
