import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveMobileConfigForUser } from "../staff/agent-mobile-config.defaults";
import {
  checkFaceVerificationRequired,
  getFaceVerificationStatus,
  readFaceReferenceBuffer,
  submitFaceVerification,
  uploadFaceReference
} from "./mobile-face.service";
import { mobileJwtRoles } from "./mobile.route.shared";
import { loadAgentMobileConfig } from "./mobile-agent-sync.config.service";
import { prisma } from "../../config/database";

async function mobileConfigForUser(tenantId: number, userId: number) {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId, is_active: true },
    select: { role: true }
  });
  if (!u) return undefined;
  const stored = await loadAgentMobileConfig(tenantId, userId);
  return resolveMobileConfigForUser(u.role, stored ? { mobile_config: stored } : {});
}

const faceContextSchema = z.enum([
  "daily_login",
  "order_submit",
  "territory_check",
  "delivery_confirm",
  "payment_accept"
]);

const faceCheckBodySchema = z.object({
  context: faceContextSchema,
  order_id: z.number().int().positive().optional(),
  client_id: z.number().int().positive().optional()
});

const faceVerifyBodySchema = faceCheckBodySchema.extend({
  image_base64: z.string().min(80).max(900_000)
});

const faceReferenceBodySchema = z.object({
  image_base64: z.string().min(80).max(900_000)
});

export async function registerMobileFaceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/me/face/status",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const userId = Number(getAccessUser(request).sub);
      const mc = await mobileConfigForUser(tenantId, userId);
      return reply.send(await getFaceVerificationStatus(tenantId, userId, mc ?? undefined));
    }
  );

  app.post(
    "/api/:slug/mobile/me/face/check-required",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = faceCheckBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const tenantId = request.tenant!.id;
      const userId = Number(getAccessUser(request).sub);
      const mc = await mobileConfigForUser(tenantId, userId);
      const result = await checkFaceVerificationRequired(
        tenantId,
        userId,
        parsed.data.context,
        mc ?? undefined,
        parsed.data
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/mobile/me/face/reference",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = faceReferenceBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const tenantId = request.tenant!.id;
      const userId = Number(getAccessUser(request).sub);
      try {
        return reply.send(await uploadFaceReference(tenantId, userId, parsed.data.image_base64));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "IMAGE_TOO_LARGE" || msg === "IMAGE_TOO_SMALL") {
          return sendApiError(reply, request, 400, "ValidationError", "Некорректный размер изображения");
        }
        if (msg === "FACE_IMAGE_BLANK") {
          return sendApiError(reply, request, 400, "ValidationError", "Лицо на фото нечёткое — сделайте снимок заново");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/me/face/verify",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = faceVerifyBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const tenantId = request.tenant!.id;
      const userId = Number(getAccessUser(request).sub);
      try {
        const result = await submitFaceVerification(tenantId, userId, parsed.data);
        if (!result.ok) {
          return sendApiError(
            reply,
            request,
            403,
            "FaceMismatch",
            "Yuz mos kelmadi — etalon rasm bilan solishtirish muvaffaqiyatsiz",
            { score: result.score, threshold: result.threshold, log_id: result.log_id }
          );
        }
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "IMAGE_TOO_LARGE" || msg === "IMAGE_TOO_SMALL") {
          return sendApiError(reply, request, 400, "ValidationError", "Некорректный размер изображения");
        }
        if (msg === "REFERENCE_MISSING") {
          return sendApiError(reply, request, 400, "ValidationError", "Нет эталонного фото — сначала загрузите его");
        }
        if (msg === "FACE_IMAGE_BLANK") {
          return sendApiError(reply, request, 400, "ValidationError", "Лицо на фото нечёткое — сделайте снимок заново");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/mobile/me/face/reference/image",
    { preHandler: [...mobileJwtRoles] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const userId = Number(getAccessUser(request).sub);
      const buf = await readFaceReferenceBuffer(tenantId, userId);
      if (!buf) return sendApiError(reply, request, 404, "NotFound");
      return reply.header("Content-Type", "image/jpeg").send(buf);
    }
  );
}
