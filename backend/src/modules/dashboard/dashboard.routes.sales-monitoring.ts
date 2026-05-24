import type { FastifyInstance } from "fastify";
import { recordDashboardPerf } from "../../lib/dashboard-perf-log";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getSalesMonitoringSnapshot, parseSalesMonitoringFilters } from "./sales-monitoring.service";
import {
  getSalesMonitoringCharts,
  getSalesMonitoringSummary,
  getSalesMonitoringTables
} from "./sales-monitoring.snapshot.partials";
import {
  applySalesMonitoringSupervisorScope,
  dashboardSalesMonitoringPreHandler
} from "./dashboard.routes.shared";

export function registerDashboardSalesMonitoringRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/dashboard/sales-monitoring/summary",
    { preHandler: dashboardSalesMonitoringPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesMonitoringFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySalesMonitoringSupervisorScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getSalesMonitoringSummary(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "sales-monitoring-summary",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/sales-monitoring/charts",
    { preHandler: dashboardSalesMonitoringPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesMonitoringFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySalesMonitoringSupervisorScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getSalesMonitoringCharts(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "sales-monitoring-charts",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/sales-monitoring/tables",
    { preHandler: dashboardSalesMonitoringPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseSalesMonitoringFilters(q);
      const accessUser = getAccessUser(request);
      applySalesMonitoringSupervisorScope(accessUser, parsed);
      const page = Number.parseInt(q.page ?? "1", 10);
      const limit = Number.parseInt(q.limit ?? "50", 10);
      const tableRaw = (q.table ?? "all").trim();
      const table =
        tableRaw === "sku_matrix" ||
        tableRaw === "branch" ||
        tableRaw === "supervisor" ||
        tableRaw === "client_daily"
          ? tableRaw
          : "all";
      const t0 = Date.now();
      const data = await getSalesMonitoringTables(request.tenant!.id, parsed, { page, limit, table });
      recordDashboardPerf(request.log, reply, {
        route: "sales-monitoring-tables",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/sales-monitoring",
    { preHandler: dashboardSalesMonitoringPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesMonitoringFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySalesMonitoringSupervisorScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getSalesMonitoringSnapshot(request.tenant!.id, parsed);
      reply.header("X-Deprecated-Endpoint", "use /dashboard/sales-monitoring/summary,/charts,/tables");
      request.log.warn({ route: "sales-monitoring-monolith" }, "Deprecated dashboard endpoint");
      recordDashboardPerf(request.log, reply, {
        route: "sales-monitoring",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );
}
