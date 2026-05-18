import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./products.route.shared";

import { unlink } from "fs/promises";
import { writeProductImportTempFile } from "../../jobs/import-temp-file";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { enqueueProductsXlsxImportJob } from "../jobs/jobs.service";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  buildProductCatalogImportTemplateBuffer,
  exportTenantCatalogProductsXlsx,
  importProductsCatalogUpdateOnlyXlsx,
  importProductsFromCatalogTemplateXlsx,
  importProductsFromXlsx
} from "./products.service";
import { readProductImportBuffer } from "./products.route.mappers";


export async function registerProductImportRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/products/import",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = await readProductImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      const result = await importProductsFromXlsx(
        request.tenant!.id,
        parsed.buf,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/products/import/async",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const parsed = await readProductImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      let tempPath: string | null = null;
      try {
        tempPath = await writeProductImportTempFile(parsed.buf);
        const { queue, jobId } = await enqueueProductsXlsxImportJob(
          tenant.id,
          actorUserIdOrNull(request),
          tempPath,
          "basic"
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
        request.log.warn({ err }, "products.import.async enqueue failed");
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

  app.get(
    "/api/:slug/products/import-template",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const buf = await buildProductCatalogImportTemplateBuffer();
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header(
          "Content-Disposition",
          'attachment; filename="import-products-template.xlsx"'
        )
        .send(buf);
    }
  );

  app.get(
    "/api/:slug/products/export-catalog",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const buf = await exportTenantCatalogProductsXlsx(request.tenant!.id);
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header(
          "Content-Disposition",
          'attachment; filename="products-catalog-export.xlsx"'
        )
        .send(buf);
    }
  );

  app.post(
    "/api/:slug/products/import-catalog",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = await readProductImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      const result = await importProductsFromCatalogTemplateXlsx(
        request.tenant!.id,
        parsed.buf,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/products/import-catalog/async",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const parsed = await readProductImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      let tempPath: string | null = null;
      try {
        tempPath = await writeProductImportTempFile(parsed.buf);
        const { queue, jobId } = await enqueueProductsXlsxImportJob(
          tenant.id,
          actorUserIdOrNull(request),
          tempPath,
          "catalog"
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
        request.log.warn({ err }, "products.import-catalog.async enqueue failed");
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

  app.post(
    "/api/:slug/products/import-catalog-update",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = await readProductImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      const result = await importProductsCatalogUpdateOnlyXlsx(
        request.tenant!.id,
        parsed.buf,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/products/import-catalog-update/async",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const parsed = await readProductImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      let tempPath: string | null = null;
      try {
        tempPath = await writeProductImportTempFile(parsed.buf);
        const { queue, jobId } = await enqueueProductsXlsxImportJob(
          tenant.id,
          actorUserIdOrNull(request),
          tempPath,
          "catalog_update"
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
        request.log.warn({ err }, "products.import-catalog-update.async enqueue failed");
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
