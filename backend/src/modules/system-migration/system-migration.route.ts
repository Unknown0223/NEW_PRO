import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { getMigrationInventory } from "./system-migration.inventory";
import { backupDownloadFilename, buildTenantBackupZip } from "./system-migration.export";
import { applyBackupZip, parseBackupZip } from "./system-migration.import";

const adminRoles = ["admin"] as const;

const applyBodySchema = z
  .object({
    force_nonempty: z.boolean().optional(),
    mode: z.enum(["full", "profile_only"]).optional()
  })
  .strict();

async function readUploadedBuffer(
  request: { file: () => Promise<{ toBuffer: () => Promise<Buffer> } | undefined> }
): Promise<Buffer | null> {
  const file = await request.file();
  if (!file) return null;
  return file.toBuffer();
}

export async function registerSystemMigrationRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/system-migration/inventory",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const inventory = await getMigrationInventory(request.tenant!.id);
      return reply.send(inventory);
    }
  );

  app.get(
    "/api/:slug/system-migration/export.backup.zip",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      try {
        const buf = await buildTenantBackupZip({
          tenantId: tenant.id,
          tenantSlug: tenant.slug
        });
        const filename = backupDownloadFilename(tenant.slug);
        return reply
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(buf);
      } catch (e) {
        if (e instanceof Error && e.message === "EMPTY_EXPORT") {
          return sendApiError(
            reply,
            request,
            400,
            "EmptyExport",
            "Eksport uchun ma’lumot yetarli emas — avval spravochniklarni to‘ldiring"
          );
        }
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/system-migration/import/preview",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const buf = await readUploadedBuffer(request);
      if (!buf?.length) {
        return sendApiError(reply, request, 400, "NoFile", "ZIP fayl yuklang");
      }
      const preview = await parseBackupZip(buf, request.tenant!.id);
      return reply.send(preview);
    }
  );

  app.post(
    "/api/:slug/system-migration/import/apply",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;

      const fields: Record<string, string> = {};
      let fileBuf: Buffer | null = null;

      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          fileBuf = await part.toBuffer();
        } else if (part.type === "field") {
          fields[part.fieldname] = String(part.value);
        }
      }

      if (!fileBuf?.length) {
        return sendApiError(reply, request, 400, "NoFile", "ZIP fayl yuklang");
      }

      const parsedFields = applyBodySchema.safeParse({
        force_nonempty: fields.force_nonempty === "true" || fields.force_nonempty === "1",
        mode: fields.mode === "profile_only" ? "profile_only" : "full"
      });
      if (!parsedFields.success) {
        return sendApiError(reply, request, 400, "ValidationError");
      }

      try {
        const result = await applyBackupZip(fileBuf, request.tenant!.id, {
          force_nonempty: parsedFields.data.force_nonempty ?? false,
          mode: parsedFields.data.mode ?? "full",
          actorUserId: actorUserIdOrNull(request)
        });
        return reply.send(result);
      } catch (e) {
        if (e instanceof Error && e.message === "TARGET_NOT_EMPTY") {
          return sendApiError(
            reply,
            request,
            409,
            "TargetNotEmpty",
            "Maqsadli tenant bo‘sh emas. Yangi serverda bo‘sh tenant oching yoki force_nonempty=1 (xavfli)."
          );
        }
        if (e instanceof Error && e.message.startsWith("IMPORT_MAP_ERROR:")) {
          return sendApiError(
            reply,
            request,
            422,
            "ImportMapError",
            e.message.replace("IMPORT_MAP_ERROR:", "")
          );
        }
        if (e instanceof Error && e.message.startsWith("INVALID_BACKUP:")) {
          return sendApiError(
            reply,
            request,
            400,
            "InvalidBackup",
            e.message.replace("INVALID_BACKUP:", "")
          );
        }
        throw e;
      }
    }
  );
}
