import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { resolveCoverRouteScope } from "./cover/cover-guard";
import { mobileOrderCreateContextQuerySchema } from "./mobile.route.agent.schemas";
import { getMobileAgentConfigPayload, getMobileOrderCreateContext } from "./mobile.service";
import { mobileAgentConfigPreHandler, mobileOfflineOrderPreHandler } from "./mobile.route.shared";
import { resolveRequestOrigin } from "./app-release.service";

export async function registerMobileAgentConfigRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/mobile/agent-config",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const versionQ = z.object({ version: z.string().max(64).optional() }).safeParse(request.query);
      const clientVersion = versionQ.success ? versionQ.data.version : undefined;
      const viewer = getAccessUser(request);
      const scope = await resolveCoverRouteScope(request.tenant!.id, viewer);
      const userId =
        viewer.role === "supervisor" && scope.viaCover
          ? scope.agentUserId
          : Number(viewer.sub);
      const result = await getMobileAgentConfigPayload(request.tenant!.id, userId, clientVersion, {
        origin: resolveRequestOrigin(request.headers)
      });
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
        work_timezone: result.work_timezone,
        work_utc_offset_hours: result.work_utc_offset_hours,
        tenant_references: result.tenant_references,
        agent_cities: result.agent_cities,
        ...(scope.viaCover
          ? { cover_acting_as_agent_id: scope.agentUserId, cover_executor_user_id: scope.executorUserId }
          : {}),
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
      const viewer = getAccessUser(request);
      const scope = await resolveCoverRouteScope(request.tenant!.id, viewer);
      const allowed =
        viewer.role === "agent" || (viewer.role === "supervisor" && scope.viaCover);
      if (!allowed || scope.agentUserId < 1) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const bundle = await getMobileOrderCreateContext(request.tenant!.id, scope.agentUserId, {
        clientId: parsed.data.selected_client_id,
        warehouseId: parsed.data.selected_warehouse_id
      });
      return reply.send(bundle);
    }
  );
}
