import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  requireRolesOrSkladchikEntitlement,
  STOCK_BALANCES_VIEW_PERMISSIONS
} from "../staff/skladchik-access.prehandler";
import { isStockWarehouseAllowed, resolveStockActorWarehouseIds } from "./stock.actor-scope";
import {
  buildRecommendedStockExportBuffer,
  buildStockByDateExportBuffer,
  listRecommendedStock,
  listStockBySpecificDate
} from "./stock.service";
import {
  recommendedExportQuerySchema,
  recommendedQuerySchema,
  stockByDateExportQuerySchema,
  stockByDateQuerySchema
} from "./stock.route.schemas";

const BY_DATE_VIEW = ["warehouse.ostatki_na_datu.view", ...STOCK_BALANCES_VIEW_PERMISSIONS] as const;
const BY_DATE_EXPORT = ["warehouse.ostatki_na_datu.copy", ...BY_DATE_VIEW] as const;
const RECOMMENDED_VIEW = [
  "warehouse.rekomendovannyy_zapas.view",
  ...STOCK_BALANCES_VIEW_PERMISSIONS
] as const;

export async function registerStockAnalyticsRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock/by-date/export",
    {
      preHandler: [
        jwtAccessVerify,
        requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list", BY_DATE_EXPORT)
      ]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockByDateExportQuerySchema.safeParse(request.query);
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
      const q = parsed.data;
      const allowedWarehouseIds = await resolveStockActorWarehouseIds(request, request.tenant!.id);
      if (!isStockWarehouseAllowed(allowedWarehouseIds, q.warehouse_id)) {
        return sendApiError(reply, request, 403, "ForbiddenWarehouse");
      }
      try {
        const buf = await buildStockByDateExportBuffer(request.tenant!.id, {
          date: q.date,
          warehouse_id: q.warehouse_id,
          category_id: q.category_id,
          product_id: q.product_id,
          price_type: q.price_type?.trim() || null,
          q: q.q ?? ""
        });
        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        reply.header("Content-Disposition", 'attachment; filename="stock-by-date.xlsx"');
        return reply.send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "EXPORT_TOO_LARGE") return sendApiError(reply, request, 413, "ExportTooLarge");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/stock/by-date",
    {
      preHandler: [
        jwtAccessVerify,
        requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list", BY_DATE_VIEW)
      ]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockByDateQuerySchema.safeParse(request.query);
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
      const q = parsed.data;
      const allowedWarehouseIds = await resolveStockActorWarehouseIds(request, request.tenant!.id);
      if (!isStockWarehouseAllowed(allowedWarehouseIds, q.warehouse_id)) {
        return sendApiError(reply, request, 403, "ForbiddenWarehouse");
      }
      try {
        const result = await listStockBySpecificDate(request.tenant!.id, {
          date: q.date,
          warehouse_id: q.warehouse_id,
          category_id: q.category_id,
          product_id: q.product_id,
          price_type: q.price_type?.trim() || null,
          q: q.q ?? "",
          page: q.page,
          limit: q.limit
        });
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/stock/recommended/export",
    {
      preHandler: [
        jwtAccessVerify,
        requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list", RECOMMENDED_VIEW)
      ]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = recommendedExportQuerySchema.safeParse(request.query);
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
      const q = parsed.data;
      const allowedWarehouseIds = await resolveStockActorWarehouseIds(request, request.tenant!.id);
      if (!isStockWarehouseAllowed(allowedWarehouseIds, q.warehouse_id)) {
        return sendApiError(reply, request, 403, "ForbiddenWarehouse");
      }
      try {
        const buf = await buildRecommendedStockExportBuffer(request.tenant!.id, {
          date_from: q.date_from,
          date_to: q.date_to,
          warehouse_id: q.warehouse_id,
          category_id: q.category_id,
          product_id: q.product_id,
          qty_mode: q.qty_mode,
          q: q.q ?? "",
          sort_by: q.sort_by,
          sort_dir: q.sort_dir,
          allowed_warehouse_ids: allowedWarehouseIds
        });
        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        reply.header("Content-Disposition", 'attachment; filename="recommended-stock.xlsx"');
        return reply.send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EXPORT_TOO_LARGE") {
          return sendApiError(reply, request, 413, "ExportTooLarge");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/stock/recommended",
    {
      preHandler: [
        jwtAccessVerify,
        requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list", RECOMMENDED_VIEW)
      ]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = recommendedQuerySchema.safeParse(request.query);
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
      const q = parsed.data;
      const allowedWarehouseIds = await resolveStockActorWarehouseIds(request, request.tenant!.id);
      if (!isStockWarehouseAllowed(allowedWarehouseIds, q.warehouse_id)) {
        return sendApiError(reply, request, 403, "ForbiddenWarehouse");
      }
      const result = await listRecommendedStock(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        warehouse_id: q.warehouse_id,
        category_id: q.category_id,
        product_id: q.product_id,
        qty_mode: q.qty_mode,
        q: q.q ?? "",
        sort_by: q.sort_by,
        sort_dir: q.sort_dir,
        page: q.page,
        limit: q.limit,
        allowed_warehouse_ids: allowedWarehouseIds
      });
      return reply.send(result);
    }
  );
}
