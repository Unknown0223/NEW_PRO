import type { FastifyInstance } from "fastify";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getDashboardStats } from "./dashboard.service";
import { getDashboardMeta } from "./dashboard.meta";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { dashboardMetaPreHandler, dashboardStatsPreHandler } from "./dashboard.routes.shared";

export function registerDashboardCoreRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/dashboard/meta",
    { preHandler: dashboardMetaPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const u = getAccessUser(request);
      const data = await getDashboardMeta(request.tenant!.id, {
        userId: actorUserIdOrNull(request),
        role: u.role
      });
      return reply.send(data);
    }
  );

  app.get(
    "/api/:slug/dashboard/stats",
    { preHandler: dashboardStatsPreHandler },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const stats = await getDashboardStats(request.tenant!.id);
      return reply.send(stats);
    }
  );
}
