import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { bulkPatchBonusRules } from "./bonus-rules.crud.bulk";
import { catalogRoles, ensureBonusRuleIdsPermission } from "./bonus-rules.route.shared";
import { bulkPatchBodySchema } from "./bonus-rules.route.schemas";

export async function registerBonusRuleBulkRoutes(app: FastifyInstance) {
  app.patch(
    "/api/:slug/bonus-rules/bulk",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkPatchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (!(await ensureBonusRuleIdsPermission(request, reply, request.tenant!.id, parsed.data.rule_ids, "update"))) return;
      const result = await bulkPatchBonusRules(
        request.tenant!.id,
        parsed.data.rule_ids,
        parsed.data.patch,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    }
  );
}
