import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { applySupervisorSelfScope } from "../dashboard/dashboard.routes.shared";
import {
  getSupervisorProducts,
  getSupervisorSummary,
  getSupervisorVisits
} from "../dashboard/dashboard.supervisor.snapshot.partials";
import { parseSupervisorDashboardFilters } from "../dashboard/dashboard.supervisor.scope";
import { listMobileSupervisorAgentLocations } from "./mobile.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileSupervisorRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/supervisor/summary",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      applySupervisorSelfScope(viewer, parsed);
      const data = await getSupervisorSummary(request.tenant!.id, parsed);
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/visits",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const q = request.query as Record<string, string | undefined>;
      const parsed = parseSupervisorDashboardFilters(q);
      applySupervisorSelfScope(viewer, parsed);
      const page = Number.parseInt(q.page ?? "1", 10) || 1;
      const limit = Number.parseInt(q.limit ?? "50", 10) || 50;
      const data = await getSupervisorVisits(request.tenant!.id, parsed, { page, limit });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/agent-locations",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const data = await listMobileSupervisorAgentLocations(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/mobile/supervisor/products",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "supervisor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = parseSupervisorDashboardFilters(request.query as Record<string, string | undefined>);
      applySupervisorSelfScope(viewer, parsed);
      const data = await getSupervisorProducts(request.tenant!.id, parsed);
      return reply.send(data);
    }
  );
}
