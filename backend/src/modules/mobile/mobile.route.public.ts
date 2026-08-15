import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureMobileApkLocal, openMobileApkReadable } from "./mobile-apk.service";

const slugQuery = z
  .string()
  .min(1)
  .max(64)
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, { message: "slug required" });

/** Public mobile: slug trim + case-insensitive (TenantNotFound kamaytirish). */
async function findActiveTenantBySlug(slug: string) {
  const exact = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, is_active: true, slug: true, settings: true }
  });
  if (exact) return exact.is_active ? exact : null;

  const rows = await prisma.tenant.findMany({
    where: { slug: { equals: slug, mode: "insensitive" }, is_active: true },
    select: { id: true, is_active: true, slug: true, settings: true },
    take: 1
  });
  return rows[0] ?? null;
}

export async function registerMobilePublicRoutes(app: FastifyInstance) {
  app.get("/api/mobile/app-release", async (request, reply) => {
    const parsed = z
      .object({
        slug: slugQuery,
        version: z.string().min(1).max(64),
        platform: z.enum(["android", "ios"]).optional()
      })
      .safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const row = await findActiveTenantBySlug(parsed.data.slug);
    if (!row) {
      return sendApiError(reply, request, 404, "TenantNotFound");
    }
    const { getMobileAppReleasePolicy, resolveAppUpdateBlock, enrichAppUpdateBlockUrl, resolveRequestOrigin } =
      await import("./app-release.service");
    const policy = await getMobileAppReleasePolicy(row.id);
    const platform = parsed.data.platform ?? "android";
    let update = resolveAppUpdateBlock(parsed.data.version, policy, platform);
    update = await enrichAppUpdateBlockUrl(
      update,
      policy,
      row.slug,
      resolveRequestOrigin(request.headers)
    );
    return reply.send({ policy, update });
  });

  // GET /api/mobile/apk-download — tenant APK (Telegram o‘rniga serverdan)
  app.get("/api/mobile/apk-download", async (request, reply) => {
    const parsed = z.object({ slug: slugQuery }).safeParse(request.query);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
    }
    const row = await findActiveTenantBySlug(parsed.data.slug);
    if (!row) {
      return sendApiError(reply, request, 404, "TenantNotFound");
    }
    await ensureMobileApkLocal(row.slug);
    const stream = await openMobileApkReadable(row.slug);
    if (!stream) {
      return sendApiError(reply, request, 404, "ApkNotFound", "Mobil APK hali yuklanmagan");
    }
    reply.header("Content-Type", "application/vnd.android.package-archive");
    reply.header("Content-Disposition", 'attachment; filename="salesdoc.apk"');
    return reply.send(stream);
  });
}
