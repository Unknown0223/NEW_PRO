import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getMobileAgentDailySales, getMobileAgentDashboard } from "./mobile.service";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";

export async function registerMobileAgentDashboardRoutes(app: FastifyInstance) {

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-dashboard — agent KPI (bugun)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-dashboard",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await getMobileAgentDashboard(request.tenant!.id, userId);
      return reply.send(data);
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/agent-daily-sales — oylik savdo (fact: buyurtma − vozvrat s polki)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/agent-daily-sales",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await getMobileAgentDailySales(request.tenant!.id, userId);
      return reply.send(data);
    }
  );
}
