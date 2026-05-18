import type { FastifyInstance } from "fastify";
import { recordDashboardPerf } from "../../lib/dashboard-perf-log";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireAnyPermission, requireRoles } from "../auth/auth.prehandlers";
import {
  getDashboardStats,
  getFinanceDashboardSnapshot,
  getSalesDashboardSnapshot,
  getSupervisorDashboardSnapshot,
  parseFinanceDashboardFilters,
  parseSalesDashboardFilters,
  parseSupervisorDashboardFilters
} from "./dashboard.service";
import { getSalesMonitoringSnapshot, parseSalesMonitoringFilters } from "./sales-monitoring.service";

const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;

/** Yangi kalit + legacy «Дашбоард» bo‘limlari (`legacy-permissions.generated.ts`) — rolda ruxsat bo‘lmasa 403. */
const DASHBOARD_ANY_LEGACY = [
  "dashboard.view",
  "dashboard.prodazhi",
  "dashboard.finansy",
  "dashboard.supervayzer",
  "dashboard.plan_fakt"
] as const;

const dashboardStatsPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission([...DASHBOARD_ANY_LEGACY])
];
const dashboardSupervisorPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.supervayzer"])
];
const dashboardFinancePreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.finansy"])
];
const dashboardSalesPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.prodazhi"])
];
const dashboardSalesMonitoringPreHandler = [
  jwtAccessVerify,
  requireRoles(...catalogRoles),
  requireAnyPermission(["dashboard.view", "dashboard.plan_fakt", "dashboard.prodazhi"])
];

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/dashboard/stats",
    { preHandler: dashboardStatsPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const stats = await getDashboardStats(request.tenant!.id);
      return reply.send(stats);
    }
  );

  app.get(
    "/api/:slug/dashboard/supervisor",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      // Supervisor o'z scope'idan tashqariga chiqmasin:
      // URL query'da supervisor_ids yuborsa ham, backendda o'z IDsi bilan majburlanadi.
      if (accessUser.role === "supervisor") {
        const selfId = Number.parseInt(accessUser.sub, 10);
        if (Number.isFinite(selfId) && selfId > 0) {
          parsed.supervisor_ids = [selfId];
        }
      }
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

  app.get(
    "/api/:slug/dashboard/finance",
    { preHandler: dashboardFinancePreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseFinanceDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      if (accessUser.role === "supervisor") {
        const selfId = Number.parseInt(accessUser.sub, 10);
        if (Number.isFinite(selfId) && selfId > 0) {
          parsed.supervisor_ids = [selfId];
        }
      }
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

  app.get(
    "/api/:slug/dashboard/sales",
    { preHandler: dashboardSalesPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesDashboardFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      if (accessUser.role === "supervisor") {
        const selfId = Number.parseInt(accessUser.sub, 10);
        if (Number.isFinite(selfId) && selfId > 0) {
          parsed.supervisor_ids = [selfId];
        }
      }
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

  app.get(
    "/api/:slug/dashboard/sales-monitoring",
    { preHandler: dashboardSalesMonitoringPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseSalesMonitoringFilters(request.query as Record<string, string | undefined>);
      const accessUser = getAccessUser(request);
      if (accessUser.role === "supervisor") {
        const selfId = Number.parseInt(accessUser.sub, 10);
        if (Number.isFinite(selfId) && selfId > 0) {
          parsed.supervisor_ids = [selfId];
        }
      }
      const t0 = Date.now();
      const data = await getSalesMonitoringSnapshot(request.tenant!.id, parsed);
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
