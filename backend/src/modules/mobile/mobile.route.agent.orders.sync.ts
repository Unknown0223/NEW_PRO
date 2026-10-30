import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { getPendingCount, syncOrders } from "./mobile.service";
import { mobileOfflineOrderPreHandler } from "./mobile.route.shared";

export async function registerMobileAgentOrderSyncRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/orders/pending",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      const result = await getPendingCount(request.tenant!.id, userId);
      return reply.send(result);
    },
  );

  app.post(
    "/api/:slug/mobile/orders/sync-flush",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number(getAccessUser(request).sub);
      const result = await syncOrders(request.tenant!.id, userId);
      return reply.send(result);
    }
  );
}