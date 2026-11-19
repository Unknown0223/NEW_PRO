import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type {
  ExpeditorReturnsFilters,
  OrderQtyFilters,
  ProductSalesReportFilters,
  ShelfReturnsFilters,
  Visits2Filters,
  VisitTotalsFilters
} from "../../contracts/reports.schemas";
import {
  expeditorReturnsQuerySchema,
  orderQtyQuerySchema,
  productSalesReportQuerySchema,
  shelfReturnsQuerySchema,
  visits2QuerySchema,
  visitTotalsQuerySchema
} from "../../contracts/reports.schemas";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  exportExpeditorReturnsXlsx,
  getExpeditorReturnsByClients,
  getExpeditorReturnsByProducts,
  getExpeditorReturnsFilterOptions,
  getExpeditorReturnsOrders
} from "./expeditor-returns-report.service";
import {
  exportShelfReturnsXlsx,
  getShelfReturnsFilterOptions,
  getShelfReturnsReport
} from "./shelf-returns-report.service";
import {
  exportOrderQtyXlsx,
  getOrderQtyFilterOptions,
  getOrderQtyReport
} from "./order-qty-report.service";
import {
  exportProductSalesReportXlsx,
  getProductSalesReport,
  getProductSalesReportFilterOptions
} from "./product-sales-report.service";
import {
  exportVisitTotalsXlsx,
  getVisitTotalsFilterOptions,
  getVisitTotalsReport
} from "./visit-totals-report.service";
import {
  exportVisits2Xlsx,
  getVisits2FilterOptions,
  getVisits2Report
} from "./visits-2-report.service";
import { ensureTenantContext } from "../../lib/tenant-context";
import { registerClientSalesReportRoutes } from "./reports.route.client-sales";
import { registerGpsDeliveryRoutesReports } from "./reports.route.gps";
import { registerP1ReportRoutes } from "./reports.route.p1";
import { registerSku3ReportRoutes } from "./reports.route.sku-3";
import { registerExpeditorShipmentsReportRoutes } from "./reports.route.expeditor-shipments";
import { registerExcelExportReportRoutes } from "./reports.route.excel-export";
import { registerInventoryReportRoutes } from "./reports.route.inventory";
import { registerPhotoReportRoutes } from "./reports.route.photo";
import { registerTasksReportRoutes } from "./reports.route.tasks";
import { registerBonusesReportRoutes } from "./reports.route.bonuses";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export async function registerReportsSpecializedRoutes(app: FastifyInstance, guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()) {
  const { reportViewPreHandler, reportExportPreHandler, incomeViewPreHandler, incomeExportPreHandler } = guards;
  registerP1ReportRoutes(app, guards);
  registerClientSalesReportRoutes(app, guards);
  registerSku3ReportRoutes(app, guards);
  registerExpeditorShipmentsReportRoutes(app, guards);
  registerExcelExportReportRoutes(app, guards);
  registerInventoryReportRoutes(app, guards);
  registerPhotoReportRoutes(app, guards);
  registerTasksReportRoutes(app, guards);
  registerBonusesReportRoutes(app, guards);

  app.get("/api/:slug/reports/product-sales/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getProductSalesReportFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/product-sales/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportProductSalesReportXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="prodazhi-po-tovaram.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/product-sales", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ProductSalesReportFilters>(
      reply,
      request,
      productSalesReportQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getProductSalesReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/expeditor-returns/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getExpeditorReturnsFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/expeditor-returns/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportExpeditorReturnsXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="vozvrat-ekspeditora.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/expeditor-returns/orders", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ExpeditorReturnsFilters>(
      reply,
      request,
      expeditorReturnsQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getExpeditorReturnsOrders(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/expeditor-returns/by-products", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const q = parseReportQueryOr400<ExpeditorReturnsFilters>(
      reply,
      request,
      expeditorReturnsQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getExpeditorReturnsByProducts(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/expeditor-returns/by-clients", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const q = parseReportQueryOr400<ExpeditorReturnsFilters>(
      reply,
      request,
      expeditorReturnsQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getExpeditorReturnsByClients(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/shelf-returns/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getShelfReturnsFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/shelf-returns/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportShelfReturnsXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="vozvrat-s-polki.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/shelf-returns", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ShelfReturnsFilters>(
      reply,
      request,
      shelfReturnsQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getShelfReturnsReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/order-qty/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getOrderQtyFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/order-qty/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportOrderQtyXlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="kolichestvo-zakazov.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/order-qty", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<OrderQtyFilters>(reply, request, orderQtyQuerySchema, reportQueryRaw(request));
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getOrderQtyReport(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/visits-2/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getVisits2FilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/visits-2/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    const { buffer, total, truncated } = await exportVisits2Xlsx(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply
      .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("Content-Disposition", 'attachment; filename="po-vizitam-2.xlsx"')
      .header("X-Export-Truncated", truncated ? "1" : "0")
      .header("X-Export-Total", String(total))
      .send(buffer);
  });

  app.get("/api/:slug/reports/visits-2", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<Visits2Filters>(
      reply,
      request,
      visits2QuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    const data = await getVisits2Report(request.tenant!.id, q, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/visit-totals/filter-options", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const u = getAccessUser(request);
    const data = await getVisitTotalsFilterOptions(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: u.role
    });
    return reply.send({ data });
  });

  app.get("/api/:slug/reports/visit-totals/export", { preHandler: reportExportPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const u = getAccessUser(request);
    try {
      const { buffer, total, truncated } = await exportVisitTotalsXlsx(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .header("Content-Disposition", 'attachment; filename="itogi-vizitov.xlsx"')
        .header("X-Export-Truncated", truncated ? "1" : "0")
        .header("X-Export-Total", String(total))
        .send(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "BAD_RANGE") {
        return sendApiError(reply, request, 400, "BAD_RANGE", "Период не более 93 дней");
      }
      throw e;
    }
  });

  app.get("/api/:slug/reports/visit-totals", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<VisitTotalsFilters>(
      reply,
      request,
      visitTotalsQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const u = getAccessUser(request);
    try {
      const data = await getVisitTotalsReport(request.tenant!.id, q, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send({ data });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "BAD_RANGE") {
        return sendApiError(reply, request, 400, "BAD_RANGE", "Период не более 93 дней");
      }
      throw e;
    }
  });

  registerGpsDeliveryRoutesReports(app, guards);
}
