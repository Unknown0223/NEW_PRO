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
import { listSupervisorAgentPhotoReports, fetchSupervisorPhotoImages } from "./dashboard.supervisor.photo-reports";
import {
  getExpeditorsDashboard,
  parseExpeditorsDashboardFilters
} from "./dashboard.expeditors.service";
import { sendApiError } from "../../lib/api-error";
import {
  applyAccessAgentIdsScope,
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
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
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
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
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
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
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
    "/api/:slug/dashboard/supervisor/photo-reports",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseSupervisorDashboardFilters(q);
      const accessUser = getAccessUser(request);
      applySupervisorSelfScope(accessUser, parsed);
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
      const agentId = Number.parseInt(q.agent_id ?? "", 10);
      if (!Number.isFinite(agentId) || agentId <= 0) {
        return sendApiError(reply, request, 400, "ValidationError", "agent_id is required");
      }
      const page = Number.parseInt(q.page ?? "1", 10);
      const limit = Number.parseInt(q.limit ?? "10", 10);
      const t0 = Date.now();
      const data = await listSupervisorAgentPhotoReports(request.tenant!.id, parsed, agentId, {
        page,
        limit,
        search: q.search?.trim()
      });
      recordDashboardPerf(request.log, reply, {
        route: "supervisor-photo-reports",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/supervisor/photo-reports/images",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const raw = q.ids?.trim() ?? "";
      const ids = raw
        .split(",")
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) {
        return sendApiError(reply, request, 400, "ValidationError", "ids is required");
      }
      if (ids.length > 100) {
        return sendApiError(reply, request, 400, "ValidationError", "Too many ids (max 100)");
      }
      const accessUser = getAccessUser(request);
      const t0 = Date.now();
      const data = await fetchSupervisorPhotoImages(request.tenant!.id, ids);
      recordDashboardPerf(request.log, reply, {
        route: "supervisor-photo-images",
        tenantId: request.tenant!.id,
        durationMs: Date.now() - t0,
        supervisorRole: accessUser.role === "supervisor"
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/dashboard/expeditors",
    { preHandler: dashboardSupervisorPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = parseExpeditorsDashboardFilters(
        request.query as Record<string, string | undefined>
      );
      const accessUser = getAccessUser(request);
      const t0 = Date.now();
      const data = await getExpeditorsDashboard(request.tenant!.id, parsed);
      recordDashboardPerf(request.log, reply, {
        route: "expeditors-dashboard",
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
      await applyAccessAgentIdsScope(request.tenant!.id, accessUser, parsed);
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
