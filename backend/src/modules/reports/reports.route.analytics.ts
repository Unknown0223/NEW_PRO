import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ReportsClientChurnQuery, ReportsDateRangeQuery, ReportsTopLimitQuery } from "../../contracts/reports.schemas";
import {
  reportsClientChurnQuerySchema,
  reportsDateRangeQuerySchema,
  reportsTopLimitQuerySchema
} from "../../contracts/reports.schemas";
import {
  getAbcAnalysis,
  getAgentKpi,
  getChannelStats,
  getClientAnalytics,
  getClientChurn,
  getOrderTrends,
  getProductSales,
  getSalesSummary,
  getStatusDistribution,
  getXyzAnalysis
} from "./reports.service";
import { ensureTenantContext } from "../../lib/tenant-context";
import { createReportRouteGuards, parseReportQueryOr400, reportQueryRaw } from "./reports.route.shared";

export async function registerReportsAnalyticsRoutes(app: FastifyInstance, guards: ReturnType<typeof createReportRouteGuards> = createReportRouteGuards()) {
  const { reportViewPreHandler, reportExportPreHandler, incomeViewPreHandler, incomeExportPreHandler } = guards;

  // Sales summary
  app.get("/api/:slug/reports/sales", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsDateRangeQuery>(
      reply,
      request,
      reportsDateRangeQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getSalesSummary(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  // Order trends (time series)
  app.get("/api/:slug/reports/order-trends", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsDateRangeQuery>(
      reply,
      request,
      reportsDateRangeQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getOrderTrends(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  // Product sales (top products)
  app.get("/api/:slug/reports/products", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsTopLimitQuery>(
      reply,
      request,
      reportsTopLimitQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getProductSales(request.tenant!.id, q.from, q.to, q.limit);
    return reply.send(data);
  });

  // Client analytics
  app.get("/api/:slug/reports/clients", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsTopLimitQuery>(
      reply,
      request,
      reportsTopLimitQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getClientAnalytics(request.tenant!.id, q.from, q.to, q.limit);
    return reply.send(data);
  });

  // Agent KPI
  app.get("/api/:slug/reports/agent-kpi", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsDateRangeQuery>(
      reply,
      request,
      reportsDateRangeQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getAgentKpi(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  // Status distribution
  app.get("/api/:slug/reports/status-distribution", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getStatusDistribution(request.tenant!.id);
    return reply.send(data);
  });

  // Channel and trade direction stats
  app.get("/api/:slug/reports/channels", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsDateRangeQuery>(
      reply,
      request,
      reportsDateRangeQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getChannelStats(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  // ABC analysis (client revenue by 80/95 rule)
  app.get("/api/:slug/reports/abc-analysis", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsDateRangeQuery>(
      reply,
      request,
      reportsDateRangeQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getAbcAnalysis(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  // XYZ analysis (client stability by coefficient of variation)
  app.get("/api/:slug/reports/xyz-analysis", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsDateRangeQuery>(
      reply,
      request,
      reportsDateRangeQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getXyzAnalysis(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  // Client churn (inactive clients)
  app.get("/api/:slug/reports/client-churn", { preHandler: reportViewPreHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = parseReportQueryOr400<ReportsClientChurnQuery>(
      reply,
      request,
      reportsClientChurnQuerySchema,
      reportQueryRaw(request)
    );
    if (!q) return;
    const data = await getClientChurn(request.tenant!.id, q.monthsAgo);
    return reply.send(data);
  });
}
