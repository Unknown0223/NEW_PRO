import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { getTenantBonusStack, updateTenantBonusStack } from "./tenant-settings.service";
import { bonusStackPatchBodySchema } from "./tenant-settings.route.schemas";

const adminRoles = ["admin"] as const;
const bonusStackReadRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export async function registerTenantSettingsBonusRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/settings/bonus-stack",
    { preHandler: [jwtAccessVerify, requireRoles(...bonusStackReadRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const json = await getTenantBonusStack(request.tenant!.id);
      return reply.send({ bonus_stack: json });
    }
  );

  app.patch(
    "/api/:slug/settings/bonus-stack",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bonusStackPatchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      const { json } = await updateTenantBonusStack(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.send({ bonus_stack: json });
    }
  );
}
