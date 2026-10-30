import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles, ensureBonusRuleIdsPermission, ensureBonusRuleTypePermission } from "./bonus-rules.route.shared";
import { createBodySchema, orderScopeBodySchema, updateBodySchema } from "./bonus-rules.route.schemas";
import { createBonusRule, updateBonusRule, updateBonusRuleOrderScope } from "./bonus-rules.service";


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
      if (!(await ensureBonusRuleTypePermission(request, reply, parsed.data.type, "create"))) return;
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
        if (msg === "CLAUSES_REQUIRED" || msg === "CLAUSE_REWARD_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ClauseRewardRequired",
            "Хотя бы в одном условии должен быть отмечен бонусный товар."
          );
        }
        if (msg === "CLAUSE_BONUS_PRODUCTS_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ClauseBonusProductsRequired",
            "В условии с бонусом выберите хотя бы один бонусный товар."
          );
        }
        if (msg === "PRODUCT_SCOPE_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ProductScopeRequired",
            "Для автоматического правила нужно выбрать ассортимент или категорию."
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
      if (!(await ensureBonusRuleIdsPermission(request, reply, request.tenant!.id, [id], "update"))) return;
      if (parsed.data.type && !(await ensureBonusRuleTypePermission(request, reply, parsed.data.type, "update"))) return;
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
        if (msg === "CLAUSES_REQUIRED" || msg === "CLAUSE_REWARD_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ClauseRewardRequired",
            "Хотя бы в одном условии должен быть отмечен бонусный товар."
          );
        }
        if (msg === "CLAUSE_BONUS_PRODUCTS_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ClauseBonusProductsRequired",
            "В условии с бонусом выберите хотя бы один бонусный товар."
          );
        }
        if (msg === "PRODUCT_SCOPE_REQUIRED") {
          return sendApiError(
            reply,
            request,
            400,
            "ProductScopeRequired",
            "Для автоматического правила нужно выбрать ассортимент или категорию."
          );
        }
        if (msg === "BAD_DATE") return sendApiError(reply, request, 400, "BadDate");
        if (msg === "RULE_LOCKED") {
          return sendApiError(
            reply,
            request,
            409,
            "RuleLocked",
            "Правило уже применялось в заказах — можно менять дату окончания, активность и привязку к заказу."
          );
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/bonus-rules/:id/order-scope",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = orderScopeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (!(await ensureBonusRuleIdsPermission(request, reply, request.tenant!.id, [id], "update"))) return;
      try {
        const row = await updateBonusRuleOrderScope(
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
        throw e;
      }
    }
  );
}
