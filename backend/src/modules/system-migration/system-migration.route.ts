import type { FastifyInstance } from "fastify";
import { createReadStream } from "fs";
import { mkdir, unlink } from "fs/promises";
import * as os from "os";
import * as path from "path";
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
import {
  backupDownloadFilename,
  buildTenantBackupZip,
  buildTenantBackupZipToFile
} from "./system-migration.export";
import {
  completeMigrationExportSession,
  createMigrationExportSession,
  failMigrationExportSession,
  getMigrationExportSession,
  reportMigrationExportProgress
} from "./system-migration.export-session";
import { applyBackupZip, parseBackupZip } from "./system-migration.import";
import {
  completeMigrationImportSession,
  createMigrationImportSession,
  failMigrationImportSession,
  getMigrationImportSession,
  reportMigrationImportProgress
} from "./system-migration.progress";

const adminRoles = ["admin"] as const;
/** Zaxira ZIP (siqilgan fotolar bilan) — eski 2GB arxivlar uchun ham bosh. */
const MIGRATION_UPLOAD_BYTES = 512 * 1024 * 1024;

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

type MultipartPart = {
  type: string;
  fieldname?: string;
  filename?: string;
  toBuffer?: () => Promise<Buffer>;
  value?: unknown;
};

async function readUploadedBuffer(
  request: {
    parts: (opts?: { limits?: { fileSize?: number } }) => AsyncIterableIterator<MultipartPart>;
    file?: () => Promise<MultipartPart | undefined>;
    log?: { warn: (obj: unknown, msg?: string) => void };
  }
): Promise<{ buf: Buffer | null; truncated: boolean; error?: string }> {
  let truncated = false;
  try {
    // Ba’zi klientlar `zip` maydoni bilan yuboradi.
    for await (const part of request.parts({ limits: { fileSize: MIGRATION_UPLOAD_BYTES } })) {
      if (part.type !== "file" || typeof part.toBuffer !== "function") continue;
      try {
        const buf = await part.toBuffer();
        if (buf?.length) return { buf, truncated: false };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/limit|too large|file size|max.*size/i.test(msg)) {
          truncated = true;
          request.log?.warn({ err: e }, "system-migration.upload truncated");
          return { buf: null, truncated: true, error: msg };
        }
        request.log?.warn({ err: e }, "system-migration.upload part failed");
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/limit|too large|file size|max.*size/i.test(msg)) {
      return { buf: null, truncated: true, error: msg };
    }
    request.log?.warn({ err: e }, "system-migration.upload parts failed");
    return { buf: null, truncated: false, error: msg };
  }
  return { buf: null, truncated };
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
        request.log.error({ err: e }, "system-migration.export.backup failed");
        if (e instanceof Error && e.message === "EMPTY_EXPORT") {
          return sendApiError(
            reply,
            request,
            400,
            "EmptyExport",
            "Недостаточно данных для экспорта — сначала заполните справочники"
          );
        }
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        const detail =
          e instanceof Error ? e.message.replace(/\s+/g, " ").trim().slice(0, 160) : "unknown";
        return sendApiError(
          reply,
          request,
          500,
          "ExportFailed",
          `Не удалось создать архив резервной копии. Повторите попытку или обратитесь в поддержку. (${detail})`
        );
      }
    }
  );

  /** Async eksport: HTTP timeout/proxy uzilishidan himoya (katta tenant). */
  app.post(
    "/api/:slug/system-migration/export/start",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const session = createMigrationExportSession(tenant.id, tenant.slug);
      const outDir = path.join(os.tmpdir(), "salesdoc-exports");
      const outPath = path.join(outDir, `${session.id}.zip`);

      void (async () => {
        try {
          await mkdir(outDir, { recursive: true });
          reportMigrationExportProgress(session.id, {
            stage: "export",
            percent: 2,
            message: "Экспорт начат…"
          });
          const { byteLength, filename } = await buildTenantBackupZipToFile(
            { tenantId: tenant.id, tenantSlug: tenant.slug },
            outPath,
            (p) => reportMigrationExportProgress(session.id, p)
          );
          completeMigrationExportSession(session.id, outPath, filename, byteLength);
          request.log.info(
            { sessionId: session.id, bytes: byteLength },
            "system-migration.export.async completed"
          );
        } catch (e) {
          request.log.error({ err: e, sessionId: session.id }, "system-migration.export.async failed");
          await unlink(outPath).catch(() => undefined);
          const detail =
            e instanceof Error ? e.message.replace(/\s+/g, " ").trim().slice(0, 200) : "unknown";
          failMigrationExportSession(
            session.id,
            `Не удалось создать архив резервной копии. (${detail})`
          );
        }
      })();

      return reply.status(202).send({
        async: true,
        sessionId: session.id,
        message: "Экспорт начат. Прогресс: GET …/export/sessions/:sessionId"
      });
    }
  );

  app.get(
    "/api/:slug/system-migration/export/sessions/:sessionId",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { sessionId } = request.params as { sessionId: string };
      const session = getMigrationExportSession(sessionId, request.tenant!.id);
      if (!session) {
        return sendApiError(reply, request, 404, "NotFound", "Сеанс экспорта не найден");
      }
      return reply.send({
        id: session.id,
        state: session.state,
        progress: session.progress,
        filename: session.filename,
        byte_length: session.byte_length,
        error: session.error
      });
    }
  );

  app.get(
    "/api/:slug/system-migration/export/sessions/:sessionId/download",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { sessionId } = request.params as { sessionId: string };
      const session = getMigrationExportSession(sessionId, request.tenant!.id);
      if (!session) {
        return sendApiError(reply, request, 404, "NotFound", "Сеанс экспорта не найден");
      }
      if (session.state === "failed") {
        return sendApiError(
          reply,
          request,
          500,
          "ExportFailed",
          session.error || "Не удалось создать архив резервной копии"
        );
      }
      if (session.state !== "completed" || !session.file_path) {
        return sendApiError(
          reply,
          request,
          409,
          "ExportNotReady",
          "Резервная копия ещё не готова — подождите немного"
        );
      }
      const filename = session.filename || backupDownloadFilename(request.tenant!.slug);
      const stream = createReadStream(session.file_path);
      return reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("Content-Length", String(session.byte_length ?? 0))
        .send(stream);
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
      const uploaded = await readUploadedBuffer(request);
      if (uploaded.truncated) {
        return sendApiError(
          reply,
          request,
          413,
          "FileTooLarge",
          "ZIP слишком большой (лимит 512 МБ). Скачайте новую «Полную резервную копию» — фото будут сжаты, затем повторите импорт."
        );
      }
      if (!uploaded.buf?.length) {
        return sendApiError(
          reply,
          request,
          400,
          "NoFile",
          "ZIP-файл не загружен. Выберите архив резервной копии через «Выбрать ZIP»."
        );
      }
      const preview = await parseBackupZip(uploaded.buf, request.tenant!.id);
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
        return sendApiError(reply, request, 404, "NotFound", "Сессия импорта не найдена");
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
      let truncated = false;

      try {
        const parts = request.parts({ limits: { fileSize: MIGRATION_UPLOAD_BYTES } });
        for await (const part of parts) {
          if (part.type === "file") {
            try {
              fileBuf = await part.toBuffer();
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              if (/limit|too large|file size|max.*size/i.test(msg)) truncated = true;
              else request.log.warn({ err: e }, "system-migration.apply file part failed");
            }
          } else if (part.type === "field") {
            fields[part.fieldname] = String(part.value);
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/limit|too large|file size|max.*size/i.test(msg)) truncated = true;
        else request.log.warn({ err: e }, "system-migration.apply parts failed");
      }

      if (truncated) {
        return sendApiError(
          reply,
          request,
          413,
          "FileTooLarge",
          "ZIP слишком большой (лимит 512 МБ). Скачайте новую «Полную резервную копию» — фото будут сжаты, затем повторите импорт."
        );
      }

      if (!fileBuf?.length) {
        return sendApiError(
          reply,
          request,
          400,
          "NoFile",
          "ZIP-файл не загружен. Выберите архив резервной копии через «Выбрать ZIP»."
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
            message: "Импорт поставлен в очередь. Прогресс: GET /api/:slug/jobs/:jobId"
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
          request.log.error({ err: e }, "system-migration.import.apply failed");
          failMigrationImportSession(session.id, humanizeMigrationApplyError(e));
        }
      })();

      return reply.status(202).send({
        async: true,
        sessionId: session.id,
        message: "Импорт начат. Прогресс: GET /api/:slug/system-migration/import/sessions/:sessionId"
      });
    }
  );
}
