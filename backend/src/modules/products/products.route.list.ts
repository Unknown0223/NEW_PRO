import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./products.route.shared";

import type { Prisma } from "@prisma/client";
import { parseProductsListQuery } from "../../contracts/products.schemas";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { prisma } from "../../config/database";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  requireIfSkladchikThenAnyEntitlement,
  SKLADCHIK_ALL_ENTITLEMENT_KEYS
} from "../staff/skladchik-access.prehandler";
import { productListInclude } from "./products.service";
import { mapProductToJson, type ProductListRow } from "./products.route.mappers";


export async function registerProductListRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/products",
    { preHandler: [jwtAccessVerify, requireIfSkladchikThenAnyEntitlement(SKLADCHIK_ALL_ENTITLEMENT_KEYS)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;

      const listQ = parseProductsListQuery(request.query as Record<string, string | undefined>);

      const where: Prisma.ProductWhereInput = {
        tenant_id: request.tenant!.id
      };

      if (listQ.search) {
        where.OR = [
          { name: { contains: listQ.search, mode: "insensitive" } },
          { sku: { contains: listQ.search, mode: "insensitive" } },
          { barcode: { contains: listQ.search, mode: "insensitive" } }
        ];
      }

      if (listQ.is_active === true) where.is_active = true;
      if (listQ.is_active === false) where.is_active = false;
      if (listQ.is_equipment === true) where.is_equipment = true;
      if (listQ.is_equipment === false) where.is_equipment = false;

      if (listQ.uncategorized) {
        where.category_id = null;
      } else if (listQ.category_id !== undefined) {
        const selected = await prisma.productCategory.findFirst({
          where: { id: listQ.category_id, tenant_id: request.tenant!.id },
          select: { id: true, name: true, parent_id: true }
        });
        if (selected) {
          const sameName = await prisma.productCategory.findMany({
            where: {
              tenant_id: request.tenant!.id,
              parent_id: selected.parent_id,
              name: { equals: selected.name, mode: "insensitive" }
            },
            select: { id: true }
          });
          const rootIds = sameName.map((c) => c.id);
          const childIds = await prisma.productCategory.findMany({
            where: { tenant_id: request.tenant!.id, parent_id: { in: rootIds } },
            select: { id: true }
          });
          const ids = [...new Set([...rootIds, ...childIds.map((c) => c.id)])];
          where.category_id = { in: ids };
        } else {
          where.category_id = listQ.category_id;
        }
      }

      if (listQ.product_group_id !== undefined) where.product_group_id = listQ.product_group_id;
      if (listQ.brand_id !== undefined) where.brand_id = listQ.brand_id;
      if (listQ.manufacturer_id !== undefined) where.manufacturer_id = listQ.manufacturer_id;
      if (listQ.segment_id !== undefined) where.segment_id = listQ.segment_id;

      // `ids` — aniq id'lar bo'yicha (masalan tanlangan mahsulotlarning joriy
      // nomlarini olish uchun). Berilganda pagination o'rniga hammasi qaytadi.
      const byIds = listQ.ids && listQ.ids.length > 0 ? listQ.ids.slice(0, 1000) : null;
      if (byIds) where.id = { in: byIds };

      const includePrices = listQ.include_prices;

      const include = {
        ...productListInclude,
        ...(includePrices
          ? {
              prices: {
                select: { id: true, price_type: true, price: true, currency: true }
              }
            }
          : {})
      } as const;

      const [total, rows] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          skip: byIds ? 0 : (listQ.page - 1) * listQ.limit,
          take: byIds ? byIds.length : listQ.limit,
          orderBy: [{ sort_order: "asc" }, { name: "asc" }, { id: "asc" }],
          include
        })
      ]);

      const data = (rows as unknown as ProductListRow[]).map(mapProductToJson);

      return reply.send({
        data,
        total,
        page: listQ.page,
        limit: listQ.limit
      });
    }
  );

  app.get(
    "/api/:slug/products/:id",
    { preHandler: [jwtAccessVerify, requireIfSkladchikThenAnyEntitlement(SKLADCHIK_ALL_ENTITLEMENT_KEYS)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const includePrices = q.include_prices === "1" || q.include_prices === "true";

      const include = {
        ...productListInclude,
        ...(includePrices
          ? {
              prices: {
                select: { id: true, price_type: true, price: true, currency: true }
              }
            }
          : {})
      } as const;

      const row = await prisma.product.findFirst({
        where: { id, tenant_id: request.tenant!.id },
        include
      });
      if (!row) {
        return sendApiError(reply, request, 404, "NotFound");
      }
      return reply.send(mapProductToJson(row as unknown as ProductListRow));
    }
  );
}
