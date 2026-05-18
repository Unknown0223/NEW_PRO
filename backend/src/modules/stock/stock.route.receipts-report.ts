import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import {
  buildStockReceiptReportExportBuffer,
  listStockReceiptReport,
  listStockReceiptReportDaily,
  listStockReceiptTimelineReport
} from "./stock.service";
import {
  stockReceiptsReportExportQuerySchema,
  stockReceiptsReportQuerySchema
} from "./stock.route.schemas";


export async function registerStockReceiptsReportRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock/receipts-report/export",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "receipt_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockReceiptsReportExportQuerySchema.safeParse(request.query);
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
      try {
        const buf = await buildStockReceiptReportExportBuffer(request.tenant!.id, {
          date_from: q.date_from,
          date_to: q.date_to,
          warehouse_id: q.warehouse_id,
          category_id: q.category_id,
          supplier_id: q.supplier_id,
          q: q.q ?? ""
        });
        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        reply.header("Content-Disposition", 'attachment; filename="stock-receipts-report.xlsx"');
        return reply.send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EXPORT_TOO_LARGE") return sendApiError(reply, request, 413, "ExportTooLarge");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/stock/receipts-report/daily",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "receipt_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockReceiptsReportQuerySchema.safeParse(request.query);
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
      const result = await listStockReceiptReportDaily(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        warehouse_id: q.warehouse_id,
        category_id: q.category_id,
        supplier_id: q.supplier_id,
        q: q.q ?? "",
        page: q.page,
        limit: q.limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/stock/receipts-report",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "receipt_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockReceiptsReportQuerySchema.safeParse(request.query);
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
      const result = await listStockReceiptReport(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        warehouse_id: q.warehouse_id,
        category_id: q.category_id,
        supplier_id: q.supplier_id,
        q: q.q ?? "",
        page: q.page,
        limit: q.limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/stock/receipts-report/timeline",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "receipt_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = stockReceiptsReportQuerySchema.safeParse(request.query);
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
      const result = await listStockReceiptTimelineReport(request.tenant!.id, {
        date_from: q.date_from,
        date_to: q.date_to,
        warehouse_id: q.warehouse_id,
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
