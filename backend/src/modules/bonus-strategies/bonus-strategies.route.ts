import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { catalogRoles } from "../bonus-rules/bonus-rules.route.shared";
import {
  createBonusStrategyBodySchema,
  updateBonusStrategyBodySchema
} from "./bonus-strategies.schemas";
import {
  createBonusStrategy,
  deleteBonusStrategy,
  getBonusStrategy,
  listBonusStrategies,
  setBonusStrategyActive,
  updateBonusStrategy
} from "./bonus-strategies.service";

function mapStrategyError(msg: string): { status: number; code: string; text?: string } | null {
  if (msg === "VALIDATION") return { status: 400, code: "ValidationError" };
  if (msg === "NOT_FOUND") return { status: 404, code: "NotFound" };
  if (msg === "STRATEGY_MIN_MEMBERS") {
    return {
      status: 400,
      code: "StrategyMinMembers",
      text: "В стратегии должно быть не менее 2 правил бонуса/скидки."
    };
  }
  if (msg === "STRATEGY_MAX_SELECT_MIN") {
    return { status: 400, code: "StrategyMaxSelectMin", text: "Условие выбора должно быть не меньше 1." };
  }
  if (msg === "STRATEGY_MAX_SELECT_TOO_HIGH") {
    return {
      status: 400,
      code: "StrategyMaxSelectTooHigh",
      text: "Число выбираемых правил должно быть хотя бы на 1 меньше числа участников (выбрать все сразу нельзя)."
    };
  }
  if (msg === "STRATEGY_BAD_RULE") {
    return {
      status: 400,
      code: "StrategyBadRule",
      text: "Привязывать можно только активные правила бонуса/скидки."
    };
  }
  if (msg === "STRATEGY_RULE_ALREADY_LINKED") {
    return {
      status: 400,
      code: "StrategyRuleAlreadyLinked",
      text: "Правило уже привязано к другой активной стратегии."
    };
  }
  return null;
}

export async function registerBonusStrategyRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/bonus-strategies",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as { active?: string };
      const active =
        q.active === "true" ? true : q.active === "false" ? false : undefined;
      const data = await listBonusStrategies(request.tenant!.id, { active });
      return reply.send({ data, total: data.length });
    }
  );

  app.get(
    "/api/:slug/bonus-strategies/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      const row = await getBonusStrategy(request.tenant!.id, id);
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send(row);
    }
  );

  app.post(
    "/api/:slug/bonus-strategies",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBonusStrategyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const row = await createBonusStrategy(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send(row);
      } catch (e) {
        const mapped = mapStrategyError(e instanceof Error ? e.message : "");
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code, mapped.text);
        throw e;
      }
    }
  );

  app.put(
    "/api/:slug/bonus-strategies/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      const parsed = updateBonusStrategyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (Object.keys(parsed.data).length === 0) {
        return sendApiError(reply, request, 400, "EmptyBody");
      }
      try {
        const row = await updateBonusStrategy(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(row);
      } catch (e) {
        const mapped = mapStrategyError(e instanceof Error ? e.message : "");
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code, mapped.text);
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/bonus-strategies/:id/active",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      const body = request.body as { is_active?: unknown };
      if (typeof body?.is_active !== "boolean") {
        return sendApiError(reply, request, 400, "ValidationError");
      }
      try {
        const row = await setBonusStrategyActive(
          request.tenant!.id,
          id,
          body.is_active,
          actorUserIdOrNull(request)
        );
        return reply.send(row);
      } catch (e) {
        const mapped = mapStrategyError(e instanceof Error ? e.message : "");
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code, mapped.text);
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/bonus-strategies/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) return sendApiError(reply, request, 400, "InvalidId");
      try {
        await deleteBonusStrategy(request.tenant!.id, id, actorUserIdOrNull(request));
        return reply.status(204).send();
      } catch (e) {
        const mapped = mapStrategyError(e instanceof Error ? e.message : "");
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code, mapped.text);
        throw e;
      }
    }
  );
}
