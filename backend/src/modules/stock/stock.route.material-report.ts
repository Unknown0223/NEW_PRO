import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { buildMaterialReportExportBuffer, listMaterialReport } from "./stock.service";
import {
  materialReportExportQuerySchema,
  materialReportQuerySchema
} from "./stock.route.schemas";


export async function registerStockMaterialReportRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock/material-report/export",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = materialReportExportQuerySchema.safeParse(request.query);
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
      const buf = await buildMaterialReportExportBuffer(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        warehouse_id: q.warehouse_id,
        category_id: q.category_id,
        product_id: q.product_id,
        qty_mode: q.qty_mode,
        q: q.q ?? "",
        mode: q.mode
      });
      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      reply.header("Content-Disposition", 'attachment; filename="material-report.xlsx"');
      return reply.send(buf);
    }
  );

  app.get(
    "/api/:slug/stock/material-report",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = materialReportQuerySchema.safeParse(request.query);
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
      const result = await listMaterialReport(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        warehouse_id: q.warehouse_id,
        category_id: q.category_id,
        product_id: q.product_id,
        qty_mode: q.qty_mode,
        q: q.q ?? "",
        page: q.page,
        limit: q.limit
      });
      return reply.send(result);
    }
  );
}
