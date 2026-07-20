import type { FastifyInstance } from "fastify";
import { recordDashboardPerf } from "../../lib/dashboard-perf-log";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getSalesDashboardSnapshot, parseSalesDashboardFilters } from "./dashboard.service";
import {
  getSalesDashboardAnalytics,
  getSalesDashboardBreakdown,
  getSalesDashboardSummary
} from "./dashboard.sales.snapshot.partials";
import { applyAccessAgentIdsScope, applySupervisorSelfScope, dashboardSalesPreHandler } from "./dashboard.routes.shared";

export function registerDashboardSalesRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/dashboard/sales/summary",
    { preHandler: dashboardSalesPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
      const t0 = Date.now();
      const data = await getSalesDashboardSummary(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "sales-summary",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/sales/analytics",
    { preHandler: dashboardSalesPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
      const t0 = Date.now();
      const data = await getSalesDashboardAnalytics(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "sales-analytics",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/sales/breakdown",
    { preHandler: dashboardSalesPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseSalesDashboardFilters(q);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
      const page = Number.parseInt(q.page ?? "1", 10);
      const limit = Number.parseInt(q.limit ?? "50", 10);
      const t0 = Date.now();
      const data = await getSalesDashboardBreakdown(request.tenant!.id, parsed, { page, limit });
      recordDashboardPerf(request.log, reply, {
        route: "sales-breakdown",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/sales",
    { preHandler: dashboardSalesPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
      const t0 = Date.now();
      const data = await getSalesDashboardSnapshot(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "sales",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );
}
