import type { FastifyInstance } from "fastify";
import {
  mobileChangePasswordBodySchema,
  mobilePatchProfileBodySchema
} from "../../contracts/mobile.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  changeMobileMePassword,
  getMobileMeProfile,
  patchMobileMeProfile
} from "./mobile-profile.service";
import { mobileJwtRoles } from "./mobile.route.shared";

export async function registerMobileProfileRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/me/profile",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      try {
        return reply.send(await getMobileMeProfile(request.tenant!.id, userId));
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/mobile/me/profile",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobilePatchProfileBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      try {
        return reply.send(await patchMobileMeProfile(request.tenant!.id, userId, parsed.data));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "AVATAR_TOO_LARGE") {
          return sendApiError(reply, request, 400, "ValidationError", "Rasm juda katta");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/me/change-password",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileChangePasswordBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      try {
        await changeMobileMePassword(request.tenant!.id, userId, parsed.data);
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "INVALID_OLD_PASSWORD") {
          return sendApiError(reply, request, 400, "ValidationError", "Eski parol noto'g'ri");
        }
        throw e;
      }
    }
  );
}
