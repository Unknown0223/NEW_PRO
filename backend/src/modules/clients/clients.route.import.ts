import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { unlink } from "fs/promises";
import { writeClientImportTempFile } from "../../jobs/import-temp-file";
import { sendApiError } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ensureTenantContext } from "../../lib/tenant-context";
import { enqueueClientsImportJob } from "../jobs/jobs.service";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import {
  buildClientImportTemplateBuffer,
  importClientsFromXlsx
} from "./clients.service";
import {
  parseClientImportMultipart,
  parseClientListQuery,
  sendClientUpdateImportTemplateXlsx
} from "./clients.route.schemas";

export async function registerClientImportRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/clients/import-update-template",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseClientListQuery(request.query as Record<string, string | undefined>);
      return sendClientUpdateImportTemplateXlsx(reply, request.tenant!.id, q);
    }
  );

  app.get(
    "/api/:slug/clients/import/template",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const buf = await buildClientImportTemplateBuffer();
      reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="mijozlar_import_shablon.xlsx"');
      return reply.send(buf);
    }
  );

  app.get(
    "/api/:slug/clients/import/update-template",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = parseClientListQuery(request.query as Record<string, string | undefined>);
      return sendClientUpdateImportTemplateXlsx(reply, request.tenant!.id, q);
    }
  );

  app.post(
    "/api/:slug/clients/import",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = await parseClientImportMultipart(request);
      if (!parsed) {
        return sendApiError(reply, request, 400, "NoFile");
      }
      const actor = getAccessUser(request);
      const sub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
      const result = await importClientsFromXlsx(request.tenant!.id, parsed.buf, {
        sheetName: parsed.sheetName,
        headerRowIndex: parsed.headerRowIndex,
        columnMap: parsed.columnMap,
        importMode: parsed.importMode,
        duplicateKeyFields: parsed.duplicateKeyFields,
        updateApplyFields: parsed.updateApplyFields,
        actorUserId
      });
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/clients/import/async",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const user = getAccessUser(request);
      const parsed = await parseClientImportMultipart(request);
      if (!parsed) {
        return sendApiError(reply, request, 400, "NoFile");
      }
      let tempPath: string | null = null;
      try {
        tempPath = await writeClientImportTempFile(parsed.buf);
        const { queue, jobId } = await enqueueClientsImportJob(tenant.id, Number(user.sub), tempPath, {
          sheetName: parsed.sheetName,
          headerRowIndex: parsed.headerRowIndex,
          columnMap: parsed.columnMap,
          importMode: parsed.importMode,
          duplicateKeyFields: parsed.duplicateKeyFields,
          updateApplyFields: parsed.updateApplyFields
        });
        tempPath = null;
        return reply.status(202).send({
          queue,
          jobId,
          message:
            "Worker ishga tushgan bo‘lsa, natija uchun GET /api/:slug/jobs/{jobId} ni so‘rang (bir xil JWT)."
        });
      } catch (err) {
        if (tempPath) {
          await unlink(tempPath).catch(() => {});
        }
        request.log.warn({ err }, "clients.import.async enqueue failed");
        return sendApiError(
          reply,
          request,
          503,
          "JobQueueUnavailable",
          "Redis yoki navbat mavjud emas. Worker va REDIS_URL ni tekshiring."
        );
      }
    }
  );
}
