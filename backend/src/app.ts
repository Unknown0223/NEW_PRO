import multipart from "@fastify/multipart";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { getAccessUser, jwtAccessVerify } from "./modules/auth/auth.prehandlers";
import { registerRoutePermissionGuard } from "./modules/access/route-permission-guard";
import { env } from "./config/env";
import { loggerOptions } from "./config/logger";
import { jwtPlugin } from "./plugins/jwt.plugin";
import { tenantPlugin } from "./plugins/tenant.plugin";
import { requestObservabilityPlugin } from "./plugins/request-observability.plugin";
import { metricsPlugin } from "./plugins/metrics.plugin";
import { sentryPlugin } from "./plugins/sentry.plugin";
import { telemetryPlugin } from "./plugins/telemetry.plugin";
import { registerBusinessMetricsRoutes } from "./modules/health/business-metrics.route";
import { registerWebVitalsRoutes } from "./modules/health/web-vitals.route";
import { ExcelImportTooLargeError } from "./lib/multipart-limits";
import { checkReadiness } from "./modules/health/health.service";
import { buildCorsOrigin } from "./lib/cors-options";
import { GLOBAL_HTTP_BODY_LIMIT_BYTES } from "./lib/constants";
import { helmetOptions } from "./lib/helmet-options";
import { sendApiError, zodValidationExtras } from "./lib/api-error";
import { registerAllRoutes } from "./route-registry";

export function buildApp() {
  const app = Fastify({
    logger: loggerOptions,
    disableRequestLogging: true,
    requestIdHeader: "x-request-id",
    /** Standart JSON body; foto marshrutlari alohida kattaroq limit oladi. */
    bodyLimit: GLOBAL_HTTP_BODY_LIMIT_BYTES
  });

  app.register(cors, { origin: buildCorsOrigin(), credentials: true });
  app.register(helmet, helmetOptions);
  app.register(multipart, {
    limits: {
      fileSize: Math.max(env.MULTIPART_MAX_FILE_BYTES, env.MULTIPART_APK_MAX_BYTES)
    }
  });
  app.register(sentryPlugin);
  app.register(telemetryPlugin);
  app.register(jwtPlugin);
  /** Faqat `config.rateLimit` berilgan marshrutlar (login) uchun — global: false */
  app.register(rateLimit, { global: false });
  app.register(tenantPlugin);
  app.register(requestObservabilityPlugin);
  app.register(metricsPlugin);
  void registerBusinessMetricsRoutes(app);
  void registerWebVitalsRoutes(app);
  /** Strukturali ruxsat tekshiruvi (RBAC_ENFORCE_PERMISSIONS=1 bo‘lganda faol). */
  registerRoutePermissionGuard(app);
  registerAllRoutes(app);

  app.get("/health", async () => ({
    status: "ok",
    time: new Date().toISOString()
  }));

  app.get("/ready", async (request, reply) => {
    const expectedToken = env.INTERNAL_HEALTH_TOKEN?.trim();
    if (expectedToken) {
      const provided = request.headers["x-internal-token"];
      const token = Array.isArray(provided) ? provided[0] : provided;
      if (token !== expectedToken) {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }

    const report = await checkReadiness();
    if (report.status === "ready") {
      return reply.send(report);
    }
    return sendApiError(reply, request, 503, "NotReady", "Database or readiness check failed", report);
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
        `Fayl juda katta. Global multipart limit: ${Math.round(env.MULTIPART_MAX_FILE_BYTES / (1024 * 1024))} MB. Excel import uchun MULTIPART_EXCEL_MAX_BYTES, APK uchun MULTIPART_APK_MAX_BYTES ni tekshiring.`,
        { maxBytes: env.MULTIPART_MAX_FILE_BYTES }
      );
    }
    if (error instanceof ExcelImportTooLargeError) {
      return sendApiError(reply, request, 413, "PayloadTooLarge", error.message, {
        maxBytes: env.MULTIPART_EXCEL_MAX_BYTES
      });
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
