import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  deleteFaceReference,
  getFaceReferenceMeta,
  uploadFaceReference
} from "../mobile/mobile-face.service";
import { catalogRoles } from "./staff.route.shared";
import { prisma } from "../../config/database";

const faceReferenceBodySchema = z.object({
  image_base64: z.string().min(80).max(900_000)
});

function parseUserId(raw: string): number | null {
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function assertUserInTenant(tenantId: number, userId: number): Promise<boolean> {
  const u = await prisma.user.findFirst({
    where: { id: userId, tenant_id: tenantId },
    select: { id: true }
  });
  return Boolean(u);
}

/** Admin/operator: xodim akkauntiga etalon yuz rasmi. */
export async function registerStaffFaceRoutes(app: FastifyInstance) {
  const pre = [jwtAccessVerify, requireRoles(...catalogRoles)];

  app.get("/api/:slug/staff/users/:userId/face-meta", { preHandler: pre }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = parseUserId(String((request.params as { userId: string }).userId));
    if (userId == null) return sendApiError(reply, request, 400, "ValidationError");
    if (!(await assertUserInTenant(request.tenant!.id, userId))) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    return reply.send(await getFaceReferenceMeta(request.tenant!.id, userId));
  });

  app.put("/api/:slug/staff/users/:userId/face-reference", { preHandler: pre }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = parseUserId(String((request.params as { userId: string }).userId));
    if (userId == null) return sendApiError(reply, request, 400, "ValidationError");
    const parsed = faceReferenceBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    if (!(await assertUserInTenant(request.tenant!.id, userId))) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    try {
      const result = await uploadFaceReference(request.tenant!.id, userId, parsed.data.image_base64);
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "IMAGE_TOO_LARGE" || msg === "IMAGE_TOO_SMALL") {
        return sendApiError(reply, request, 400, "ValidationError", "Некорректный размер изображения");
      }
      if (msg === "FACE_IMAGE_BLANK") {
        return sendApiError(reply, request, 400, "ValidationError", "Лицо на фото нечёткое");
      }
      throw e;
    }
  });

  app.delete("/api/:slug/staff/users/:userId/face-reference", { preHandler: pre }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const userId = parseUserId(String((request.params as { userId: string }).userId));
    if (userId == null) return sendApiError(reply, request, 400, "ValidationError");
    if (!(await assertUserInTenant(request.tenant!.id, userId))) {
      return sendApiError(reply, request, 404, "NotFound");
    }
    try {
      return reply.send(await deleteFaceReference(request.tenant!.id, userId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      throw e;
    }
  });
}
