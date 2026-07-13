import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { listMobileExpeditorDeliveries } from "./mobile.expeditor.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

export async function registerMobileExpeditorDeliveryRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/expeditor/deliveries",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const q = request.query as { page?: string; limit?: string; status?: string };
      const data = await listMobileExpeditorDeliveries(request.tenant!.id, userId, {
        page: Number.parseInt(q.page ?? "1", 10) || 1,
        limit: Number.parseInt(q.limit ?? "50", 10) || 50,
        status: q.status?.trim() || undefined
      });
      return reply.send(data);
    }
  );
}
