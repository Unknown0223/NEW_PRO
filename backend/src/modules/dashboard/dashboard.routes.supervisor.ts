import type { FastifyInstance } from "fastify";
import { recordDashboardPerf } from "../../lib/dashboard-perf-log";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  getSupervisorDashboardSnapshot,
  parseSupervisorDashboardFilters
} from "./dashboard.service";
import {
  getSupervisorProducts,
  getSupervisorSummary,
  getSupervisorVisits
} from "./dashboard.supervisor.snapshot.partials";
import {
  applySupervisorSelfScope,
  dashboardSupervisorPreHandler
} from "./dashboard.routes.shared";

export function registerDashboardSupervisorRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/dashboard/supervisor/summary",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getSupervisorSummary(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "supervisor-summary",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/supervisor/visits",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseSupervisorDashboardFilters(q);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const page = Number.parseInt(q.page ?? "1", 10);
      const limit = Number.parseInt(q.limit ?? "50", 10);
      const t0 = Date.now();
      const data = await getSupervisorVisits(request.tenant!.id, parsed, { page, limit });
      recordDashboardPerf(request.log, reply, {
        route: "supervisor-visits",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/supervisor/products",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getSupervisorProducts(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "supervisor-products",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/supervisor",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getSupervisorDashboardSnapshot(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "supervisor",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );
}
