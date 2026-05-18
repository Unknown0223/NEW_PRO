import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  createCurrencyExchangeRate,
  deleteCurrencyExchangeRate,
  listCurrencyExchangeRates,
  patchCurrencyExchangeRate
} from "./currency-exchange-rates.service";

const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
const readPreHandler = [jwtAccessVerify] as const;
const writePreHandler = [jwtAccessVerify, requireRoles(...writeRoles)] as const;

const listValidationErrors = new Set(["BAD_FROM_DATE", "BAD_TO_DATE", "BAD_BASE", "BAD_QUOTE"]);
const createOrPatchValidationErrors = new Set(["BAD_CURRENCY_CODE", "BAD_RATE_DATE", "BAD_RATE"]);

function sendInvalidId(reply: FastifyReply, request: FastifyRequest) {
  return sendApiError(reply, request, 400, "ValidationError", "Invalid id", { field: "id" });
}

function sendKnownDomainError(reply: FastifyReply, request: FastifyRequest, message: string): boolean {
  if (listValidationErrors.has(message)) {
    return Boolean(
      sendApiError(reply, request, 400, "ValidationError", "Invalid currency-rates filter", {
        domainCode: message
      })
    );
  }
  if (message === "SAME_CURRENCY") {
    return Boolean(
      sendApiError(
        reply,
        request,
        400,
        "ValidationError",
        "База и котировка должны быть разными валютами (например USD → UZS).",
        { domainCode: message }
      )
    );
  }
  if (createOrPatchValidationErrors.has(message)) {
    const human: Record<string, string> = {
      BAD_CURRENCY_CODE: "Некорректный код валюты.",
      BAD_RATE_DATE: "Некорректная дата курса (ожидается YYYY-MM-DD).",
      BAD_RATE: "Курс должен быть положительным числом."
    };
    return Boolean(
      sendApiError(reply, request, 400, "ValidationError", human[message] ?? message, {
        domainCode: message
      })
    );
  }
  if (message === "CURRENCY_NOT_IN_DIRECTORY") {
    return Boolean(
      sendApiError(reply, request, 400, "ValidationError", "Добавьте валюты в Настройки → Валюты или включите их.", {
        domainCode: message
      })
    );
  }
  if (message === "DUPLICATE_RATE") {
    return Boolean(
      sendApiError(reply, request, 409, "Conflict", "На эту дату пара уже существует.", { domainCode: message })
    );
  }
  if (message === "NOT_FOUND") {
    return Boolean(sendApiError(reply, request, 404, "NotFound"));
  }
  return false;
}

const createBodySchema = z.object({
  rate_date: z.string().min(10).max(10),
  base_currency: z.string().min(2).max(20),
  quote_currency: z.string().min(2).max(20),
  rate: z.union([z.string(), z.number()]),
  source: z.string().max(64).nullable().optional(),
  note: z.string().max(500).nullable().optional()
});

const patchBodySchema = createBodySchema.partial();

export async function registerCurrencyExchangeRateRoutes(app: FastifyInstance) {
  app.get("/api/:slug/currency-rates", { preHandler: [...readPreHandler] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "50", 10) || 50));
    try {
      const data = await listCurrencyExchangeRates(request.tenant!.id, {
        page,
        limit,
        from: q.from?.trim() || q.date_from?.trim(),
        to: q.to?.trim() || q.date_to?.trim(),
        base: q.base?.trim(),
        quote: q.quote?.trim()
      });
      return reply.send(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (sendKnownDomainError(reply, request, msg)) return;
      throw e;
    }
  });

  app.post(
    "/api/:slug/currency-rates",
    { preHandler: [...writePreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
      }
      try {
        const row = await createCurrencyExchangeRate(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (sendKnownDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/currency-rates/:id",
    { preHandler: [...writePreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id < 1) {
        return sendInvalidId(reply, request);
      }
      const parsed = patchBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
      }
      try {
        const row = await patchCurrencyExchangeRate(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (sendKnownDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/currency-rates/:id",
    { preHandler: [...writePreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id < 1) {
        return sendInvalidId(reply, request);
      }
      try {
        await deleteCurrencyExchangeRate(request.tenant!.id, id);
        return reply.status(204).send();
      } catch (e) {
        if (e instanceof Error && sendKnownDomainError(reply, request, e.message)) return;
        throw e;
      }
    }
  );
}
