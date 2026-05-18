import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { unlink } from "fs/promises";
import { writeStockImportTempFile } from "../../jobs/import-temp-file";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { enqueueStockImportJob } from "../jobs/jobs.service";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  buildPostupleniya2StockTemplateBuffer,
  buildStockImportTemplateBuffer,
  importStockReceiptFromXlsx
} from "./stock.service";
import { parseStockImportMultipart } from "./stock.route.schemas";


export async function registerStockImportRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock/import-template",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const kind = String((request.query as { kind?: string }).kind ?? "").toLowerCase();
      const post2 = kind === "postupleniya2" || kind === "postupleniya_2" || kind === "p2";
      const buf = post2
        ? await buildPostupleniya2StockTemplateBuffer()
        : await buildStockImportTemplateBuffer();
      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      reply.header(
        "Content-Disposition",
        post2
          ? 'attachment; filename="postupleniya-kirim-shablon.xlsx"'
          : 'attachment; filename="ombor-kirim-shablon.xlsx"'
      );
      return reply.send(buf);
    }
  );

  app.post(
    "/api/:slug/stock/import",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = await parseStockImportMultipart(request);
      if (!parsed) {
        return sendApiError(reply, request, 400, "NoFile");
      }
      if (parsed.buf.length === 0) {
        return sendApiError(reply, request, 400, "EmptyFile");
      }
      const result = await importStockReceiptFromXlsx(
        request.tenant!.id,
        parsed.buf,
        actorUserIdOrNull(request),
        parsed.defaultWarehouseId != null ? { defaultWarehouseId: parsed.defaultWarehouseId } : undefined
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/stock/import/async",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const parsed = await parseStockImportMultipart(request);
      if (!parsed) {
        return sendApiError(reply, request, 400, "NoFile");
      }
      if (parsed.buf.length === 0) {
        return sendApiError(reply, request, 400, "EmptyFile");
      }
      let tempPath: string | null = null;
      try {
        tempPath = await writeStockImportTempFile(parsed.buf);
        const { queue, jobId } = await enqueueStockImportJob(
          tenant.id,
          actorUserIdOrNull(request),
          tempPath,
          parsed.defaultWarehouseId != null ? { defaultWarehouseId: parsed.defaultWarehouseId } : undefined
        );
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
        request.log.warn({ err }, "stock.import.async enqueue failed");
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
