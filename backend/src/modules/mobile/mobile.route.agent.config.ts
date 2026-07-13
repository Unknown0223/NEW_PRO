import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { mobileOrderCreateContextQuerySchema } from "./mobile.route.agent.schemas";
import { getMobileAgentConfigPayload, getMobileOrderCreateContext } from "./mobile.service";
import { mobileAgentConfigPreHandler, mobileOfflineOrderPreHandler } from "./mobile.route.shared";

export async function registerMobileAgentConfigRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/agent-config",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const versionQ = z.object({ version: z.string().max(64).optional() }).safeParse(request.query);
      const clientVersion = versionQ.success ? versionQ.data.version : undefined;
      const userId = Number(getAccessUser(request).sub);
      const result = await getMobileAgentConfigPayload(request.tenant!.id, userId, clientVersion);
      if (!result.ok) {
        return sendApiError(reply, request, 403, result.error);
      }
      return reply.send({
        user_id: result.user_id,
        tenant_name: request.tenant!.name,
        mobile_config: result.mobile_config,
        agent_entitlements: result.agent_entitlements,
        agent_limits: result.agent_limits,
        work_slot_id: result.work_slot_id,
        work_slot_code: result.work_slot_code,
        tenant_references: result.tenant_references,
        agent_cities: result.agent_cities,
        ...(result.app_update ? { app_update: result.app_update } : {})
      });
    }
  );

  app.get(
    "/api/:slug/mobile/orders/create-context",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileOrderCreateContextQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      const role = getAccessUser(request).role;
      if (role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const bundle = await getMobileOrderCreateContext(request.tenant!.id, userId, {
        clientId: parsed.data.selected_client_id,
        warehouseId: parsed.data.selected_warehouse_id
      });
      return reply.send(bundle);
    }
  );
}
