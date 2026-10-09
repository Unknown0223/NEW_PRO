import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { OPERATOR_LIKE_WEB_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { adminRoles } from "./staff.route.shared";

const bodySchema = z.object({
  user_ids: z.array(z.number().int().positive()).min(1).max(500),
  filter_visible: z.boolean()
});

export function registerOperatorFilterVisibleRoute(app: FastifyInstance) {
  app.post(
    "/api/:slug/operators/filter-visible",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bodySchema.safeParse(request.body);
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
      const ids = [...new Set(parsed.data.user_ids)];
      const count = await prisma.user.count({
        where: {
          tenant_id: request.tenant!.id,
          id: { in: ids },
          role: { in: [...OPERATOR_LIKE_WEB_ROLES] }
        }
      });
      if (count !== ids.length) return sendApiError(reply, request, 400, "BadUserIds");
      await prisma.user.updateMany({
        where: { tenant_id: request.tenant!.id, id: { in: ids } },
        data: { filter_visible: parsed.data.filter_visible }
      });
      return reply.send({ data: { updated: ids.length } });
    }
  );
}
