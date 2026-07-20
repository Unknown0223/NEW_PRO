import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./products.route.shared";

import {
  bulkProductsKpiGroupBodySchema,
  createProductBodySchema,
  updateProductBodySchema
} from "../../contracts/products.schemas";
import { bulkSetProductsKpiGroup } from "../sales-directions/sales-directions.kpi";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { createProduct, softDeleteProduct, updateProduct } from "./products.service";
import { mapProductToJson, type ProductListRow } from "./products.route.mappers";


export async function registerProductWriteRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/products",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createProductBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createProduct(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(mapProductToJson(row as unknown as ProductListRow));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "SKU_EXISTS") return sendApiError(reply, request, 409, "SkuExists");
        if (msg === "NAME_EXISTS") return sendApiError(reply, request, 409, "NameExists");
        if (msg === "BARCODE_EXISTS") return sendApiError(reply, request, 409, "BarcodeExists");
        if (msg === "BAD_CATEGORY") return sendApiError(reply, request, 400, "BadCategory");
        if (msg === "BAD_REF") return sendApiError(reply, request, 400, "BadRef");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  app.put(
    "/api/:slug/products/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = updateProductBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (Object.keys(parsed.data).length === 0) {
        return sendApiError(reply, request, 400, "EmptyBody");
      }
      try {
        const row = await updateProduct(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(mapProductToJson(row as unknown as ProductListRow));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "SKU_EXISTS") return sendApiError(reply, request, 409, "SkuExists");
        if (msg === "NAME_EXISTS") return sendApiError(reply, request, 409, "NameExists");
        if (msg === "BARCODE_EXISTS") return sendApiError(reply, request, 409, "BarcodeExists");
        if (msg === "BAD_CATEGORY") return sendApiError(reply, request, 400, "BadCategory");
        if (msg === "BAD_REF") return sendApiError(reply, request, 400, "BadRef");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/products/bulk-kpi-group",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkProductsKpiGroupBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const result = await bulkSetProductsKpiGroup(
          request.tenant!.id,
          parsed.data.product_ids,
          parsed.data.kpi_group_id,
          actorUserIdOrNull(request)
        );
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_PRODUCT_IDS") return sendApiError(reply, request, 400, "BadProductIds");
        throw e;
      }
    }
  );

  /** Mahsulotni fizik o‘chirmaydi — `is_active: false` (neaktiv ro‘yxatga o‘tadi). */
  app.delete(
    "/api/:slug/products/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const row = await softDeleteProduct(request.tenant!.id, id, actorUserIdOrNull(request));
        return reply.send(row);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );
}
