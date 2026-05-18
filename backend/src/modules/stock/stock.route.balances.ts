import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { buildStockBalancesExportBuffer, listStockBalances } from "./stock.service";
import {
  stockBalancesExportQuerySchema,
  stockBalancesQuerySchema
} from "./stock.route.schemas";


export async function registerStockBalancesRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock/balances/export",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockBalancesExportQuerySchema.safeParse(request.query);
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
      if (q.view === "valuation" && !q.price_type?.trim()) {
        return sendApiError(reply, request, 400, "PriceTypeRequired");
      }
      try {
        const buf = await buildStockBalancesExportBuffer(request.tenant!.id, {
          purpose: q.purpose,
          warehouse_id: q.warehouse_id,
          category_id: q.category_id,
          group_id: q.group_id,
          active_only: q.active_only === "true",
          qty_mode: q.qty_mode,
          q: q.q ?? "",
          view: q.view,
          price_type: q.price_type?.trim() ?? null,
          sort: q.sort
        });
        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        reply.header("Content-Disposition", 'attachment; filename="ostatki.xlsx"');
        return reply.send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "PRICE_TYPE_REQUIRED") {
          return sendApiError(reply, request, 400, "PriceTypeRequired");
        }
        if (msg === "EXPORT_TOO_LARGE") {
          return sendApiError(reply, request, 413, "ExportTooLarge");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/stock/balances",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockBalancesQuerySchema.safeParse(request.query);
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
      if (q.view === "valuation" && !q.price_type?.trim()) {
        return sendApiError(reply, request, 400, "PriceTypeRequired");
      }
      try {
        const result = await listStockBalances(request.tenant!.id, {
          purpose: q.purpose,
          warehouse_id: q.warehouse_id,
          category_id: q.category_id,
          group_id: q.group_id,
          active_only: q.active_only === "true",
          qty_mode: q.qty_mode,
          q: q.q ?? "",
          view: q.view,
          price_type: q.price_type?.trim() ?? null,
          page: q.page,
          limit: q.limit,
          sort: q.sort
        });
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "PRICE_TYPE_REQUIRED") {
          return sendApiError(reply, request, 400, "PriceTypeRequired");
        }
        throw e;
      }
    }
  );
}
