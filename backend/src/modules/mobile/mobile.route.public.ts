import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { mobileApkExists, openMobileApkReadStream } from "./mobile-apk.service";

export async function registerMobilePublicRoutes(app: FastifyInstance) {
  app.get("/api/mobile/app-release", async (request, reply) => {
    const parsed = z
      .object({
        slug: z.string().min(1).max(64),
        version: z.string().min(1).max(64),
        platform: z.enum(["android", "ios"]).optional()
      })
      .safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const row = await prisma.tenant.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true, is_active: true, settings: true }
    });
    if (!row || !row.is_active) {
      return sendApiError(reply, request, 404, "TenantNotFound");
    }
    const { getMobileAppReleasePolicy, resolveAppUpdateBlock, enrichAppUpdateBlockUrl, resolveRequestOrigin } =
      await import("./app-release.service");
    const policy = await getMobileAppReleasePolicy(row.id);
    const platform = parsed.data.platform ?? "android";
    let update = resolveAppUpdateBlock(parsed.data.version, policy, platform);
    update = enrichAppUpdateBlockUrl(update, policy, parsed.data.slug, resolveRequestOrigin(request.headers));
    return reply.send({ policy, update });
  });

  // GET /api/mobile/apk-download — tenant APK (Telegram o‘rniga serverdan)
  app.get("/api/mobile/apk-download", async (request, reply) => {
    const parsed = z.object({ slug: z.string().min(1).max(64) }).safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const row = await prisma.tenant.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true, is_active: true, slug: true }
    });
    if (!row || !row.is_active) {
      return sendApiError(reply, request, 404, "TenantNotFound");
    }
    if (!mobileApkExists(row.slug)) {
      return sendApiError(reply, request, 404, "ApkNotFound", "Mobil APK hali yuklanmagan");
    }
    const stream = openMobileApkReadStream(row.slug);
    if (!stream) {
      return sendApiError(reply, request, 404, "ApkNotFound");
    }
    reply.header("Content-Type", "application/vnd.android.package-archive");
    reply.header("Content-Disposition", 'attachment; filename="salesdoc.apk"');
    return reply.send(stream);
  });
}
