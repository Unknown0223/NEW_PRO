import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { getAccessUser, jwtAccessVerify } from "./modules/auth/auth.prehandlers";
import { registerAuthRoutes } from "./modules/auth/auth.route";
import { registerClientRoutes } from "./modules/clients/clients.route";
import { registerBonusRuleRoutes } from "./modules/bonus-rules/bonus-rules.route";
import { registerOrderRoutes } from "./modules/orders/orders.route";
import { registerOrderStreamRoutes } from "./modules/orders/order-stream.route";
import { registerReferenceRoutes } from "./modules/reference/reference.route";
import { registerTenantSettingsRoutes } from "./modules/tenant-settings/tenant-settings.route";
import { registerGoodsReceiptRoutes } from "./modules/stock/goods-receipt.route";
import { registerStockRoutes } from "./modules/stock/stock.route";
import { registerRetailStockRoutes } from "./modules/stock/retail-stock.route";
import { registerWarehouseBlockRoutes } from "./modules/stock/warehouse-blocks.route";
import { registerSupplierRoutes } from "./modules/stock/suppliers.route";
import { registerDashboardRoutes } from "./modules/dashboard/dashboard.route";
import { registerPaymentRoutes } from "./modules/payments/payments.route";
import { registerOpeningBalanceRoutes } from "./modules/opening-balances/opening-balances.route";
import { registerClientBalanceRoutes } from "./modules/client-balances/client-balances.route";
import { registerSalesReturnRoutes } from "./modules/returns/sales-returns.route";
import { registerCashDeskRoutes } from "./modules/cash-desks/cash-desks.route";
import { registerCurrencyExchangeRateRoutes } from "./modules/currency-rates/currency-exchange-rates.route";
import { registerProductCatalogRoutes } from "./modules/products/product-catalog.route";
import { registerProductPriceRoutes } from "./modules/products/product-prices.route";
import { registerProductRoutes } from "./modules/products/products.route";
import { registerAuditEventRoutes } from "./modules/audit-events/audit-events.route";
import { registerUserUiRoutes } from "./modules/users/user-ui.route";
import { registerStaffRoutes } from "./modules/staff/staff.route";
import { registerConsignmentRoutes } from "./modules/consignment/consignment.route";
import { registerSalesDirectionRoutes } from "./modules/sales-directions/sales-directions.route";
import { registerReportRoutes } from "./modules/reports/reports.route";
import { registerStockTakeRoutes } from "./modules/stock/stock-takes.route";
import { registerWarehouseTransferRoutes } from "./modules/stock/warehouse-transfers.route";
import { registerExpenseRoutes } from "./modules/expenses/expenses.route";
import { registerFieldRoutes } from "./modules/field/field.route";
import { registerTerritoryRoutes } from "./modules/territory/territory.route";
import { registerPriceMatrixRoutes } from "./modules/products/price-matrix.route";
import { registerNotificationRoutes } from "./modules/notifications/notifications.route";
import { registerMobileRoutes } from "./modules/mobile/mobile.route";
import { registerJobRoutes } from "./modules/jobs/jobs.route";
import { registerLinkageRoutes } from "./modules/linkage/linkage.route";
import { registerClientQrRoutes } from "./modules/client-qr/client-qr.route";
import { registerTimesheetRoutes } from "./modules/timesheet/timesheet.route";
import { registerWorkSlotRoutes } from "./modules/work-slots/work-slots.route";
import { registerAccessRoutes } from "./modules/access/access.route";
import { env } from "./config/env";
import { prisma } from "./config/database";
import { loggerOptions } from "./config/logger";
import { jwtPlugin } from "./plugins/jwt.plugin";
import { tenantPlugin } from "./plugins/tenant.plugin";
import { requestObservabilityPlugin } from "./plugins/request-observability.plugin";
import { isOrderEventBusRedisEnabled } from "./lib/order-event-bus";
import { pingAppRedis } from "./lib/redis-cache";
import { buildCorsOrigin } from "./lib/cors-options";
import { sendApiError, zodValidationExtras } from "./lib/api-error";

export function buildApp() {
  const app = Fastify({
    logger: loggerOptions,
    disableRequestLogging: true,
    requestIdHeader: "x-request-id"
  });

  app.register(cors, { origin: buildCorsOrigin() });
  app.register(multipart, { limits: { fileSize: env.MULTIPART_MAX_FILE_BYTES } });
  app.register(jwtPlugin);
  /** Faqat `config.rateLimit` berilgan marshrutlar (login) uchun — global: false */
  app.register(rateLimit, { global: false });
  app.register(tenantPlugin);
  app.register(requestObservabilityPlugin);
  app.register(registerAuthRoutes);
  app.register(registerAccessRoutes);
  app.register(registerUserUiRoutes);
  app.register(registerClientRoutes);
  app.register(registerProductPriceRoutes);
  app.register(registerProductCatalogRoutes);
  app.register(registerProductRoutes);
  app.register(registerStaffRoutes);
  app.register(registerConsignmentRoutes);
  app.register(registerSalesDirectionRoutes);
  app.register(registerBonusRuleRoutes);
  app.register(registerOrderRoutes);
  app.register(registerOrderStreamRoutes);
  app.register(registerDashboardRoutes);
  app.register(registerPaymentRoutes);
  app.register(registerOpeningBalanceRoutes);
  app.register(registerClientBalanceRoutes);
  app.register(registerSalesReturnRoutes);
  app.register(registerReferenceRoutes);
  app.register(registerTenantSettingsRoutes);
  app.register(registerAuditEventRoutes);
  app.register(registerStockRoutes);
  app.register(registerRetailStockRoutes);
  app.register(registerWarehouseBlockRoutes);
  app.register(registerSupplierRoutes);
  app.register(registerGoodsReceiptRoutes);
  app.register(registerCashDeskRoutes);
  app.register(registerCurrencyExchangeRateRoutes);
  app.register(
    fp(
      async (app) => {
        await registerReportRoutes(app);
      },
      { name: "register-report-routes", fastify: "4.x" }
    )
  );
  app.register(registerStockTakeRoutes);
  app.register(registerWarehouseTransferRoutes);
  app.register(registerExpenseRoutes);
  app.register(registerTerritoryRoutes);
  app.register(registerPriceMatrixRoutes);
  app.register(registerFieldRoutes);
  app.register(registerNotificationRoutes);
  app.register(registerMobileRoutes);
  app.register(registerLinkageRoutes);
  app.register(registerClientQrRoutes);
  app.register(registerJobRoutes);
  app.register(registerTimesheetRoutes);
  app.register(registerWorkSlotRoutes);

  app.get("/health", async () => ({
    status: "ok",
    time: new Date().toISOString()
  }));

  app.get("/ready", async (request, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const appCacheRedis = await pingAppRedis();
      return reply.send({
        status: "ready",
        database: "ok",
        redis: isOrderEventBusRedisEnabled() ? "ok" : "degraded",
        app_cache_redis: appCacheRedis,
        time: new Date().toISOString()
      });
    } catch {
      const appCacheRedis = await pingAppRedis().catch(() => "down" as const);
      return sendApiError(reply, request, 503, "NotReady", "Database or readiness check failed", {
        status: "not_ready",
        database: "down",
        redis: isOrderEventBusRedisEnabled() ? "ok" : "degraded",
        app_cache_redis: appCacheRedis,
        time: new Date().toISOString()
      });
    }
  });

  app.get("/api/:slug/protected", {
    preHandler: [jwtAccessVerify]
  }, async (request, reply) => {
    if (!request.tenant) {
      return sendApiError(reply, request, 404, "TenantNotFound");
    }
    const jwtUser = getAccessUser(request);
    if (Number(jwtUser.tenantId) !== request.tenant.id) {
      return sendApiError(reply, request, 403, "CrossTenantDenied");
    }

    return reply.send({
      ok: true,
      tenant: request.tenant.slug,
      userId: jwtUser.sub
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;
    app.log.error({ err: error, requestId }, error.message);
    const code = (error as { code?: string }).code;
    if (code === "FST_REQ_FILE_TOO_LARGE") {
      return sendApiError(
        reply,
        request,
        413,
        "PayloadTooLarge",
        `Fayl juda katta. Maksimal hajm: ${Math.round(env.MULTIPART_MAX_FILE_BYTES / (1024 * 1024))} MB. Kichikroq .xlsx yoki .env da MULTIPART_MAX_FILE_BYTES ni oshiring.`,
        { maxBytes: env.MULTIPART_MAX_FILE_BYTES }
      );
    }
    if (error instanceof ZodError) {
      return sendApiError(
        reply,
        request,
        400,
        "ValidationError",
        "Request validation failed",
        zodValidationExtras(error)
      );
    }
    const sc = (error as { statusCode?: number }).statusCode;
    if (sc) {
      if (sc === 429) {
        return sendApiError(reply, request, 429, "TooManyRequests", error.message || "Rate limit exceeded");
      }
      return sendApiError(reply, request, sc, error.name, error.message);
    }
    const prismaCode =
      error !== null &&
      typeof error === "object" &&
      (error as { name?: string }).name === "PrismaClientKnownRequestError" &&
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined;
    if (prismaCode === "P2022" || prismaCode === "P2021") {
      return sendApiError(
        reply,
        request,
        503,
        "DatabaseSchemaMismatch",
        "Baza migratsiyalari to‘liq qo‘llanmagan (jadval/ustun yetishmayapti). Backend papkasida: npm run db:deploy",
        { prismaCode }
      );
    }
    const errName = (error as { name?: string }).name;
    if (errName === "PrismaClientValidationError") {
      return sendApiError(reply, request, 400, "DatabaseValidationError", (error as Error).message);
    }
    return sendApiError(reply, request, 500, "InternalServerError", "Unexpected server error");
  });

  return app;
}
