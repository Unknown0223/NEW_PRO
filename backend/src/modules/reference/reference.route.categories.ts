import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { adminRoles, catalogRoles } from "./reference.route.shared";
import { createCategoryBody, patchCategoryBody } from "./reference.route.schemas";
import {
  createProductCategoryRow,
  deleteProductCategoryRow,
  listProductCategoriesForTenant,
  updateProductCategoryRow
} from "./reference.service";


export async function registerReferenceCategoryRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/product-categories",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listProductCategoriesForTenant(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/product-categories",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createCategoryBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const row = await createProductCategoryRow(
          request.tenant!.id,
          {
            name: parsed.data.name,
            parent_id: parsed.data.parent_id ?? null,
            code: parsed.data.code ?? null,
            sort_order: parsed.data.sort_order ?? null,
            default_unit: parsed.data.default_unit ?? null,
            is_active: parsed.data.is_active,
            comment: parsed.data.comment ?? null
          },
          actorUserIdOrNull(request)
        );
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_NAME") return sendApiError(reply, request, 400, "EmptyName");
        if (msg === "BAD_PARENT") return sendApiError(reply, request, 400, "BadParent");
        if (msg === "BAD_CODE") return sendApiError(reply, request, 400, "BadCode");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/product-categories/:categoryId",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { categoryId: string }).categoryId, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchCategoryBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const row = await updateProductCategoryRow(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "EMPTY_NAME" || msg === "BAD_PARENT") {
          return sendApiError(reply, request, 400, msg === "EMPTY_NAME" ? "EmptyName" : "BadParent");
        }
        if (msg === "BAD_CODE") return sendApiError(reply, request, 400, "BadCode");
        if (msg === "EMPTY_PATCH") return sendApiError(reply, request, 400, "EmptyBody");
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/product-categories/:categoryId",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { categoryId: string }).categoryId, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await deleteProductCategoryRow(request.tenant!.id, id, actorUserIdOrNull(request));
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "HAS_CHILDREN") return sendApiError(reply, request, 409, "HasChildren");
        if (msg === "CATEGORY_IN_USE") return sendApiError(reply, request, 409, "CategoryInUse");
        throw e;
      }
    }
  );
}
