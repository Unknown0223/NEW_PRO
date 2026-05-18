import { unlink } from "fs/promises";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { writePriceImportTempFile } from "../../jobs/import-temp-file";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { enqueueProductPricesImportJob } from "../jobs/jobs.service";
import { getTenantDefaultCurrencyCode } from "../tenant-settings/tenant-settings.service";
import {
  bulkUpsertPricesForType,
  getProductPrice,
  importProductPricesFromXlsx,
  listCategoryPricesMatrix,
  listProductPrices,
  syncProductPrices
} from "./product-prices.service";

const putPricesSchema = z.object({
  items: z.array(
    z.object({
      price_type: z.string().min(1),
      price: z.number().nonnegative()
    })
  )
});

const matrixPatchSchema = z.object({
  price_type: z.string().min(1).max(128),
  currency: z.string().min(2).max(20).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        price: z.number().nonnegative()
      })
    )
    .min(1)
    .max(5000)
});

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

async function readPriceImportBuffer(
  request: FastifyRequest
): Promise<{ ok: true; buf: Buffer } | { ok: false; error: "NoFile" | "EmptyFile" }> {
  const file = await request.file();
  if (!file) {
    return { ok: false, error: "NoFile" };
  }
  const buf = await file.toBuffer();
  if (buf.length === 0) {
    return { ok: false, error: "EmptyFile" };
  }
  return { ok: true, buf };
}

export async function registerProductPriceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/product-prices/resolve",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const productId = Number.parseInt(q.product_id ?? "", 10);
      if (Number.isNaN(productId)) {
        return sendApiError(reply, request, 400, "BadQuery", "product_id majburiy");
      }
      const priceType = (q.price_type ?? "retail").trim() || "retail";
      const product = await prisma.product.findFirst({
        where: { id: productId, tenant_id: request.tenant!.id }
      });
      if (!product) {
        return sendApiError(reply, request, 404, "NotFound");
      }
      const price = await getProductPrice(request.tenant!.id, productId, priceType);
      const currency = await getTenantDefaultCurrencyCode(request.tenant!.id);
      return reply.send({
        product_id: productId,
        price_type: priceType,
        price,
        currency
      });
    }
  );

  app.get(
    "/api/:slug/products/prices/matrix",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const categoryId = Number.parseInt(q.category_id ?? "", 10);
      const priceType = (q.price_type ?? "").trim();
      if (Number.isNaN(categoryId) || !priceType) {
        return sendApiError(reply, request, 400, "BadQuery", "category_id va price_type majburiy");
      }
      try {
        const currency = await getTenantDefaultCurrencyCode(request.tenant!.id);
        const data = await listCategoryPricesMatrix(request.tenant!.id, categoryId, priceType, currency);
        return reply.send({ data, currency });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/products/prices/matrix",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = matrixPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const cur =
        parsed.data.currency?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) ||
        (await getTenantDefaultCurrencyCode(request.tenant!.id));
      try {
        await bulkUpsertPricesForType(
          request.tenant!.id,
          parsed.data.price_type,
          parsed.data.items,
          cur,
          actorUserIdOrNull(request)
        );
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/products/:id/prices",
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const rows = await listProductPrices(request.tenant!.id, id);
        return reply.send({ data: rows });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.put(
    "/api/:slug/products/:id/prices",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = putPricesSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const rows = await syncProductPrices(
          request.tenant!.id,
          id,
          parsed.data.items,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: rows });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/products/prices/import",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = await readPriceImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      const result = await importProductPricesFromXlsx(
        request.tenant!.id,
        parsed.buf,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/products/prices/import/async",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = request.tenant!;
      const parsed = await readPriceImportBuffer(request);
      if (!parsed.ok) {
        return sendApiError(reply, request, 400, parsed.error);
      }
      let tempPath: string | null = null;
      try {
        tempPath = await writePriceImportTempFile(parsed.buf);
        const { queue, jobId } = await enqueueProductPricesImportJob(
          tenant.id,
          actorUserIdOrNull(request),
          tempPath
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
        request.log.warn({ err }, "product-prices.import.async enqueue failed");
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
