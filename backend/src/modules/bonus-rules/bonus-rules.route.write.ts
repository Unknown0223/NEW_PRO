import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "./bonus-rules.route.shared";
import { createBodySchema, updateBodySchema } from "./bonus-rules.route.schemas";
import { createBonusRule, updateBonusRule } from "./bonus-rules.service";


export async function registerBonusRuleWriteRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/bonus-rules",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createBonusRule(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "PRODUCT_SCOPE_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ProductScopeRequired",
            "Avtomatik qoida uchun assortiment yoki kategoriya tanlanishi kerak."
          );
        }
        if (msg === "BAD_DATE") return sendApiError(reply, request, 400, "BadDate");
        throw e;
      }
    }
  );

  app.put(
    "/api/:slug/bonus-rules/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = updateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (Object.keys(parsed.data).length === 0) {
        return sendApiError(reply, request, 400, "EmptyBody");
      }
      try {
        const row = await updateBonusRule(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "PRODUCT_SCOPE_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ProductScopeRequired",
            "Avtomatik qoida uchun assortiment yoki kategoriya tanlanishi kerak."
          );
        }
        if (msg === "BAD_DATE") return sendApiError(reply, request, 400, "BadDate");
        throw e;
      }
    }
  );
}
