import type { FastifyInstance } from "fastify";
import { sendApiError } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { recordMobileStockSnapshot } from "./mobile-order-policy";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";

export async function registerMobileStockSnapshotRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/mobile/stock-snapshot",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      if (!Number.isFinite(userId) || userId < 1) {
        return sendApiError(reply, request, 401, "Unauthorized");
      }
      await recordMobileStockSnapshot(request.tenant!.id, userId);
      return reply.send({ ok: true });
    }
  );
}
