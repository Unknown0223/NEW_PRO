import type { FastifyInstance } from "fastify";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { listOrderDebtsReport } from "../reports/order-debts-report.service";
import {
  mobileCreateClientBodySchema,
  mobilePatchClientBodySchema
} from "./mobile.route.agent.schemas";
import {
  createMobileAgentClient,
  listMobileAgentClientLedgerBalances,
  listMobileAgentDebtors,
  patchMobileAgentClient
} from "./mobile.service";
import { mobileAgentConfigPreHandler } from "./mobile.route.shared";

export async function registerMobileAgentClientRoutes(app: FastifyInstance) {

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/clients — agent yangi mijoz
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/clients",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const parsed = mobileCreateClientBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await createMobileAgentClient(request.tenant!.id, userId, parsed.data);
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "DUPLICATE_PHONE") {
          return sendApiError(reply, request, 409, "DuplicatePhone", "Bu telefon mavjud.");
        }
        if (msg === "DUPLICATE_NAME") {
          return sendApiError(reply, request, 409, "DuplicateName", "Shu nomga mijoz mavjud.");
        }
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        if (msg === "CLIENT_CREATE_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Mijoz yaratish ruxsat etilmagan");
        }
        if (msg === "CLIENT_LOCATION_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Koordinatalarni o'zgartirish taqiqlangan");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // PATCH /api/:slug/mobile/clients/:id — agent mijoz tahriri
  // -----------------------------------------------------------------------
  app.patch(
    "/api/:slug/mobile/clients/:id",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const bodyParsed = mobilePatchClientBodySchema.safeParse(request.body ?? {});
      if (!bodyParsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(bodyParsed.error));
      }
      const userId = Number.parseInt(viewer.sub, 10);
      try {
        const row = await patchMobileAgentClient(
          request.tenant!.id,
          userId,
          idParsed.data.id,
          bodyParsed.data
        );
        return reply.send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (msg === "CLIENT_EDIT_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Mijozni tahrirlash ruxsat etilmagan");
        }
        if (msg === "CLIENT_LOCATION_FORBIDDEN") {
          return sendApiError(reply, request, 403, "Forbidden", "Koordinatalarni o'zgartirish taqiqlangan");
        }
        if (msg === "VALIDATION") return sendApiError(reply, request, 400, "ValidationError");
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/clients/balances — agent bo‘yicha umumiy balanslar
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/clients/balances",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await listMobileAgentClientLedgerBalances(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/clients/debtors — qarzdor mijozlar
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/clients/debtors",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const data = await listMobileAgentDebtors(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/order-debts — zakaz bo‘yicha qarzlar (agent scope)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/order-debts",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number.parseInt(viewer.sub, 10);
      const raw = request.query as Record<string, string | undefined>;
      const data = await listOrderDebtsReport(request.tenant!.id, {
        ...raw,
        agent_id: String(userId),
        page: raw.page ?? "1",
        limit: raw.limit ?? "50"
      });
      return reply.send(data);
    }
  );
}
