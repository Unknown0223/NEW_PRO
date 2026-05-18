import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  createInterchangeableProductGroup,
  createProductBrand,
  createProductCatalogGroup,
  createProductManufacturer,
  createProductSegment,
  deleteInterchangeableProductGroup,
  deleteProductBrand,
  deleteProductCatalogGroup,
  deleteProductManufacturer,
  deleteProductSegment,
  getInterchangeableExchangeLookupForProduct,
  getInterchangeableProductGroup,
  listInterchangeableProductGroups,
  listProductBrands,
  listProductCatalogGroups,
  listProductManufacturers,
  listProductSegments,
  updateInterchangeableProductGroup,
  updateProductBrand,
  updateProductCatalogGroup,
  updateProductManufacturer,
  updateProductSegment
} from "./product-catalog.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  search: z.string().optional(),
  is_active: z.enum(["true", "false"]).optional()
});

const simpleBodySchema = z.object({
  name: z.string().min(1),
  code: z.string().max(24).nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
  is_active: z.boolean().optional()
});

const simplePatchSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().max(24).nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
  is_active: z.boolean().optional()
});

const interchangeableBodySchema = z.object({
  name: z.string().min(1),
  code: z.string().max(24).nullable().optional(),
  sort_order: z.number().int().nullable().optional(),
  comment: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
  price_types: z.array(z.string().min(1).max(128)).optional()
});

const interchangeablePatchSchema = interchangeableBodySchema.partial();

function parseListQuery(q: Record<string, unknown>) {
  const parsed = listQuerySchema.safeParse(q);
  if (!parsed.success) return null;
  const { page, limit, search, is_active } = parsed.data;
  let active: boolean | null = null;
  if (is_active === "true") active = true;
  if (is_active === "false") active = false;
  return { page, limit, search: search?.trim() || undefined, is_active: active };
}

function mapErr(reply: FastifyReply, request: FastifyRequest, e: unknown) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
  if (msg === "IN_USE") return sendApiError(reply, request, 409, "InUse");
  if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
  if (msg === "BAD_PRICE_TYPE") {
    const ex = e as Error & { price_type?: string };
    return sendApiError(reply, request, 400, "BadPriceType", undefined, { price_type: ex.price_type });
  }
  if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
  throw e;
}

function isoDates<T extends Record<string, unknown>>(row: T): T & Record<string, unknown> {
  const o = { ...row } as Record<string, unknown>;
  if (o.created_at instanceof Date) o.created_at = o.created_at.toISOString();
  if (o.updated_at instanceof Date) o.updated_at = o.updated_at.toISOString();
  return o as T & Record<string, unknown>;
}

export async function registerProductCatalogRoutes(app: FastifyInstance) {
  const regSimple = (
    path: string,
    list: typeof listProductCatalogGroups,
    create: typeof createProductCatalogGroup,
    update: typeof updateProductCatalogGroup,
    del: typeof deleteProductCatalogGroup
  ) => {
    app.get(path, { preHandler: [jwtAccessVerify] }, async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const opts = parseListQuery(request.query as Record<string, unknown>);
      if (!opts) return sendApiError(reply, request, 400, "BadQuery");
      const { total, data } = await list(request.tenant!.id, opts);
      return reply.send({
        data: data.map((r) => isoDates(r as Record<string, unknown>)),
        total,
        page: opts.page,
        limit: opts.limit
      });
    });

    app.post(
      path,
      { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
      async (request, reply) => {
        if (!ensureTenantContext(request, reply)) return;
        const parsed = simpleBodySchema.safeParse(request.body);
        if (!parsed.success) {
          return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
        }
        try {
          const row = await create(request.tenant!.id, parsed.data);
          return reply.status(201).send(isoDates(row as Record<string, unknown>));
        } catch (e) {
          return mapErr(reply, request, e);
        }
      }
    );

    app.put(
      `${path}/:id`,
      { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
      async (request, reply) => {
        if (!ensureTenantContext(request, reply)) return;
        const id = Number.parseInt((request.params as { id: string }).id, 10);
        if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
        const parsed = simplePatchSchema.safeParse(request.body);
        if (!parsed.success) {
          return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
        }
        if (Object.keys(parsed.data).length === 0) {
          return sendApiError(reply, request, 400, "EmptyBody");
        }
        try {
          const row = await update(request.tenant!.id, id, parsed.data);
          return reply.send(isoDates(row as Record<string, unknown>));
        } catch (e) {
          return mapErr(reply, request, e);
        }
      }
    );

    app.delete(
      `${path}/:id`,
      { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
      async (request, reply) => {
        if (!ensureTenantContext(request, reply)) return;
        const id = Number.parseInt((request.params as { id: string }).id, 10);
        if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
        try {
          await del(request.tenant!.id, id);
          return reply.status(204).send();
        } catch (e) {
          return mapErr(reply, request, e);
        }
      }
    );
  };

  regSimple(
    "/api/:slug/catalog/product-groups",
    listProductCatalogGroups,
    createProductCatalogGroup,
    updateProductCatalogGroup,
    deleteProductCatalogGroup
  );
  regSimple(
    "/api/:slug/catalog/brands",
    listProductBrands,
    createProductBrand,
    updateProductBrand,
    deleteProductBrand
  );
  regSimple(
    "/api/:slug/catalog/manufacturers",
    listProductManufacturers,
    createProductManufacturer,
    updateProductManufacturer,
    deleteProductManufacturer
  );
  regSimple(
    "/api/:slug/catalog/segments",
    listProductSegments,
    createProductSegment,
    updateProductSegment,
    deleteProductSegment
  );

  const interchangePath = "/api/:slug/catalog/interchangeable-groups";

  app.get(
    `${interchangePath}/exchange-lookup/:productId`,
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const productId = Number.parseInt((request.params as { productId: string }).productId, 10);
      if (Number.isNaN(productId) || productId < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const priceType = (q.price_type ?? "retail").trim() || "retail";
      const row = await getInterchangeableExchangeLookupForProduct(
        request.tenant!.id,
        productId,
        priceType
      );
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send(row);
    }
  );

  app.get(interchangePath, { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const opts = parseListQuery(request.query as Record<string, unknown>);
    if (!opts) return sendApiError(reply, request, 400, "BadQuery");
    const { total, data } = await listInterchangeableProductGroups(request.tenant!.id, opts);
    return reply.send({
      data: data.map((g) => ({
        ...g,
        created_at: g.created_at.toISOString(),
        updated_at: g.updated_at.toISOString()
      })),
      total,
      page: opts.page,
      limit: opts.limit
    });
  });

  app.post(
    interchangePath,
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = interchangeableBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createInterchangeableProductGroup(request.tenant!.id, parsed.data);
        return reply.status(201).send(isoDates(row as Record<string, unknown>));
      } catch (e) {
        return mapErr(reply, request, e);
      }
    }
  );

  app.put(
    `${interchangePath}/:id`,
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      const parsed = interchangeablePatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (Object.keys(parsed.data).length === 0) {
        return sendApiError(reply, request, 400, "EmptyBody");
      }
      try {
        await updateInterchangeableProductGroup(request.tenant!.id, id, parsed.data);
        const found = await getInterchangeableProductGroup(request.tenant!.id, id);
        if (!found) return sendApiError(reply, request, 404, "NotFound");
        return reply.send({
          ...found,
          created_at: found.created_at.toISOString(),
          updated_at: found.updated_at.toISOString()
        });
      } catch (e) {
        return mapErr(reply, request, e);
      }
    }
  );

  app.delete(
    `${interchangePath}/:id`,
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      try {
        await deleteInterchangeableProductGroup(request.tenant!.id, id);
        return reply.status(204).send();
      } catch (e) {
        return mapErr(reply, request, e);
      }
    }
  );

}
