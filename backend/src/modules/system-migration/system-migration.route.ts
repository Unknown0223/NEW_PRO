import type { FastifyInstance } from "fastify";
import { unlink } from "fs/promises";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import { writeMigrationImportTempFile } from "../../jobs/import-temp-file";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { enqueueSystemMigrationImportJob } from "../jobs/jobs.service";
import {
  humanizeMigrationApplyError,
  mapMigrationApplyError
} from "./system-migration.apply-errors";
import { getMigrationInventory } from "./system-migration.inventory";
import { backupDownloadFilename, buildTenantBackupZip } from "./system-migration.export";
import { applyBackupZip, parseBackupZip } from "./system-migration.import";
import {
  completeMigrationImportSession,
  createMigrationImportSession,
  failMigrationImportSession,
  getMigrationImportSession,
  reportMigrationImportProgress
} from "./system-migration.progress";

const adminRoles = ["admin"] as const;
/** Zaxira ZIP (foto URI bilans) katta bo‘lishi mumkin. */
const MIGRATION_UPLOAD_BYTES = 256 * 1024 * 1024;

const applyBodySchema = z
  .object({
    force_nonempty: z.boolean().optional(),
    mode: z.enum(["full", "profile_only"]).optional(),
    conflict_policy: z.enum(["keep", "replace"]).optional(),
    modules: z.array(z.string()).optional(),
    /** true = sync (test); default async + progress */
    sync: z.boolean().optional()
  })
  .strict();

function parseModulesField(raw: string | undefined): string[] | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x)).filter(Boolean);
    }
  } catch {
    /* comma-separated fallback */
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function readUploadedBuffer(request: {
  parts: () => AsyncIterableIterator<{
    type: string;
    toBuffer?: () => Promise<Buffer>;
  }>;
}): Promise<Buffer | null> {
  // apply bilan bir xil: parts() — field tartibi va Content-Type edge-case lariga chidamli.
  try {
    for await (const part of request.parts()) {
      if (part.type === "file" && typeof part.toBuffer === "function") {
        const buf = await part.toBuffer();
        if (buf?.length) return buf;
      }
    }
  } catch {
    return null;
  }
  return null;
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
    {
      preHandler: [jwtAccessVerify, requireRoles(...adminRoles)],
      bodyLimit: MIGRATION_UPLOAD_BYTES
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const buf = await readUploadedBuffer(request);
      if (!buf?.length) {
        return sendApiError(
          reply,
          request,
          400,
          "NoFile",
          "ZIP fayl yuklanmadi. «ZIP tanlash» orqali zaxira arxivini tanlang."
        );
      }
      const preview = await parseBackupZip(buf, request.tenant!.id);
      return reply.send(preview);
    }
  );

  app.get(
    "/api/:slug/system-migration/import/sessions/:sessionId",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const sessionId = String((request.params as { sessionId?: string }).sessionId ?? "");
      const session = getMigrationImportSession(sessionId, request.tenant!.id);
      if (!session) {
        return sendApiError(reply, request, 404, "NotFound", "Import sessiyasi topilmadi");
      }
      return reply.send(session);
    }
  );

  app.post(
    "/api/:slug/system-migration/import/apply",
    {
      preHandler: [jwtAccessVerify, requireRoles(...adminRoles)],
      bodyLimit: MIGRATION_UPLOAD_BYTES
    },
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
        return sendApiError(
          reply,
          request,
          400,
          "NoFile",
          "ZIP fayl yuklanmadi. «ZIP tanlash» orqali zaxira arxivini tanlang."
        );
      }

      const parsedFields = applyBodySchema.safeParse({
        force_nonempty: fields.force_nonempty === "true" || fields.force_nonempty === "1",
        mode: fields.mode === "profile_only" ? "profile_only" : "full",
        conflict_policy: fields.conflict_policy === "replace" ? "replace" : "keep",
        modules: parseModulesField(fields.modules),
        sync: fields.sync === "true" || fields.sync === "1"
      });
      if (!parsedFields.success) {
        return sendApiError(reply, request, 400, "ValidationError");
      }

      const force = parsedFields.data.force_nonempty ?? false;
      const mode = parsedFields.data.mode ?? "full";
      const conflict_policy = parsedFields.data.conflict_policy ?? "keep";
      const modules = parsedFields.data.modules;
      const actorUserId = actorUserIdOrNull(request);
      const tenantId = request.tenant!.id;
      const applyOpts = {
        force_nonempty: force,
        mode,
        conflict_policy,
        modules,
        actorUserId
      } as const;

      if (parsedFields.data.sync) {
        try {
          const result = await applyBackupZip(fileBuf, tenantId, applyOpts);
          return reply.send(result);
        } catch (e) {
          if (mapMigrationApplyError(reply, request, e)) return;
          throw e;
        }
      }

      // Asosiy: API process ichida sessiya + progress (worker versiyasiga bog‘lanmaydi).
      // Ixtiyoriy: fields.use_queue=1 → BullMQ worker (prod horizontal scale).
      const useQueue = fields.use_queue === "true" || fields.use_queue === "1";
      if (useQueue) {
        let tempPath: string | null = null;
        try {
          tempPath = await writeMigrationImportTempFile(fileBuf);
          const { queue, jobId } = await enqueueSystemMigrationImportJob(
            tenantId,
            actorUserId,
            tempPath,
            { force_nonempty: force, mode, conflict_policy, modules }
          );
          tempPath = null;
          return reply.status(202).send({
            async: true,
            queue,
            jobId,
            message: "Import navbatga qo‘yildi. Progress: GET /api/:slug/jobs/:jobId"
          });
        } catch (err) {
          if (tempPath) await unlink(tempPath).catch(() => {});
          request.log.warn({ err }, "system-migration.import.queue failed — session fallback");
        }
      }

      const session = createMigrationImportSession(tenantId);
      const bufCopy = fileBuf;
      void (async () => {
        try {
          const result = await applyBackupZip(bufCopy, tenantId, {
            ...applyOpts,
            onProgress: (p) => {
              reportMigrationImportProgress(session.id, p);
            }
          });
          completeMigrationImportSession(session.id, result);
        } catch (e) {
          failMigrationImportSession(session.id, humanizeMigrationApplyError(e));
        }
      })();

      return reply.status(202).send({
        async: true,
        sessionId: session.id,
        message: "Import boshlandi. Progress: GET /api/:slug/system-migration/import/sessions/:sessionId"
      });
    }
  );
}
