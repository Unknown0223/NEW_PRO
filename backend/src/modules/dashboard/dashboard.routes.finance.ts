import type { FastifyInstance } from "fastify";
import { recordDashboardPerf } from "../../lib/dashboard-perf-log";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import {
  getFinanceDashboardSnapshot,
  parseFinanceDashboardFilters
} from "./dashboard.service";
import { getFinanceDashboardSummary } from "./dashboard.finance.snapshot.partials";
import { getFinanceDashboardDebts } from "./dashboard.finance.debts";
import { applySupervisorSelfScope, dashboardFinancePreHandler } from "./dashboard.routes.shared";

export function registerDashboardFinanceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/dashboard/finance/summary",
    { preHandler: dashboardFinancePreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseFinanceDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getFinanceDashboardSummary(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "finance-summary",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/finance/debts",
    { preHandler: dashboardFinancePreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseFinanceDashboardFilters(q);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const page = Number.parseInt(q.page ?? "1", 10);
      const limit = Number.parseInt(q.limit ?? "50", 10);
      const t0 = Date.now();
      const data = await getFinanceDashboardDebts(request.tenant!.id, parsed, { page, limit });
      recordDashboardPerf(request.log, reply, {
        route: "finance-debts",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/finance",
    { preHandler: dashboardFinancePreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseFinanceDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      const t0 = Date.now();
      const data = await getFinanceDashboardSnapshot(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "finance",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );
}
