import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  bankTransferAssignBodySchema, bankTransferChannelSchema, bankTransferCommentBodySchema,
  bankTransferCreatePaymentBodySchema, bankTransferIgnoreBodySchema, bankTransferIngestBodySchema,
  bankTransferManualCreateBodySchema, bankTransferReassignBodySchema
} from "../../contracts/bank-transfer-inbox.schemas";
import { ingestBankTransfers } from "./bank-transfer-inbox.ingest";
import { createManualBankTransfer } from "./bank-transfer-inbox.manual";
import {
  assignInboxClient, commentInboxItem, createPendingPaymentFromInbox, getBankTransferInboxDetail,
  getInboxTabCounts, ignoreInboxItem, listBankTransferInbox, reassignInboxClient
} from "./bank-transfer-inbox.service";
import {
  parseBankTransferCsv,
  parseBankTransferObjectRows,
  parseBankTransferXlsxBase64
} from "./bank-transfer-inbox.import";

/** Кассир + operator-like (подтверждение оплат). */
const inboxRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "cashier"] as const;

function sendDomainError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  message: string
): boolean {
  const map: Record<string, { status: number; code: string; human: string }> = {
    NOT_FOUND: { status: 404, code: "NotFound", human: "Запись не найдена" },
    BAD_CLIENT: { status: 400, code: "ValidationError", human: "Клиент не найден или неактивен" },
    COMMENT_REQUIRED: {
      status: 400,
      code: "ValidationError",
      human: "Комментарий обязателен (минимум 3 символа)"
    },
    BAD_STATUS: { status: 409, code: "Conflict", human: "Недопустимый статус записи" },
    PAYMENT_EXISTS: { status: 409, code: "Conflict", human: "Платёж уже создан" },
    NO_CLIENT: { status: 400, code: "ValidationError", human: "Сначала назначьте клиента" },
    BAD_CASH_DESK: { status: 400, code: "ValidationError", human: "Касса не найдена" },
    CASH_DESK_NO_CLIENT_PAYMENTS: {
      status: 400,
      code: "ValidationError",
      human: "Касса не принимает оплаты клиентов"
    },
    PAYMENT_CONFIRMED: {
      status: 409,
      code: "Conflict",
      human: "Нельзя переназначить: платёж уже подтверждён"
    },
    PAYMENT_NOT_PENDING: {
      status: 409,
      code: "Conflict",
      human: "Переназначение только для pending_confirmation"
    },
    PAYMENT_NOT_FOUND: { status: 404, code: "NotFound", human: "Связанный платёж не найден" },
    HAS_PENDING_PAYMENT: {
      status: 409,
      code: "Conflict",
      human: "Сначала отклоните или подтвердите связанный платёж"
    },
    BAD_PAID_AT: {
      status: 400,
      code: "ValidationError",
      human: "Некорректная дата оплаты"
    }
  };
  const hit = map[message];
  if (!hit) return false;
  sendApiError(reply, request, hit.status, hit.code, hit.human, { domainCode: message });
  return true;
}

export async function registerBankTransferInboxRoutes(app: FastifyInstance) {
  const pre = [jwtAccessVerify, requireRoles(...inboxRoles)] as const;

  app.get("/api/:slug/bank-transfer-inbox/counts", { preHandler: [...pre] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const channelParsed = bankTransferChannelSchema.safeParse(q.channel?.trim());
    const counts = await getInboxTabCounts(
      request.tenant!.id,
      channelParsed.success ? channelParsed.data : undefined
    );
    return reply.send({ data: counts });
  });

  app.get("/api/:slug/bank-transfer-inbox", { preHandler: [...pre] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));
    const tabRaw = q.tab?.trim();
    const tab =
      tabRaw === "new" ||
      tabRaw === "ambiguous" ||
      tabRaw === "unmatched" ||
      tabRaw === "pending" ||
      tabRaw === "done" ||
      tabRaw === "all"
        ? tabRaw
        : "all";
    const channelParsed = bankTransferChannelSchema.safeParse(q.channel?.trim());
    const result = await listBankTransferInbox(request.tenant!.id, {
      page,
      limit,
      tab,
      search: q.search?.trim() || undefined,
      channel: channelParsed.success ? channelParsed.data : undefined
    });
    return reply.send(result);
  });

  app.get(
    "/api/:slug/bank-transfer-inbox/:id",
    { preHandler: [...pre] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id < 1) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid id");
      }
      const detail = await getBankTransferInboxDetail(request.tenant!.id, id);
      if (!detail) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: detail });
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/ingest",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bankTransferIngestBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid body",
          zodValidationExtras(parsed.error)
        );
      }
      const result = await ingestBankTransfers(
        request.tenant!.id,
        parsed.data,
        actorUserIdOrNull(request)
      );
      return reply.code(201).send({ data: result });
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/manual",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bankTransferManualCreateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid body",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const detail = await createManualBankTransfer(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.code(201).send({ data: detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ERR";
        if (sendDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/import",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const body = request.body as {
        source?: string;
        csv?: string;
        rows?: Record<string, unknown>[];
        xlsx_base64?: string;
      };
      const source =
        body.source === "excel" || body.source === "csv" || body.source === "manual"
          ? body.source
          : typeof body.xlsx_base64 === "string" && body.xlsx_base64.trim()
            ? "excel"
            : body.csv
              ? "csv"
              : "excel";

      let parsed =
        typeof body.xlsx_base64 === "string" && body.xlsx_base64.trim()
          ? parseBankTransferXlsxBase64(body.xlsx_base64)
          : typeof body.csv === "string" && body.csv.trim()
            ? parseBankTransferCsv(body.csv)
            : Array.isArray(body.rows)
              ? parseBankTransferObjectRows(body.rows)
              : null;
      if (!parsed) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Ожидается csv, rows[] или xlsx_base64"
        );
      }
      if (parsed.items.length === 0) {
        return reply.send({
          data: { created: 0, skipped: 0, results: [], row_errors: parsed.errors }
        });
      }
      const ingest = await ingestBankTransfers(
        request.tenant!.id,
        { source, items: parsed.items },
        actorUserIdOrNull(request)
      );
      return reply.code(201).send({
        data: { ...ingest, row_errors: parsed.errors }
      });
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/:id/assign",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const parsed = bankTransferAssignBodySchema.safeParse(request.body);
      if (!Number.isFinite(id) || id < 1 || !parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid request",
          parsed.success ? undefined : zodValidationExtras(parsed.error)
        );
      }
      try {
        const detail = await assignInboxClient(
          request.tenant!.id,
          id,
          parsed.data.client_id,
          parsed.data.comment,
          actorUserIdOrNull(request),
          {
            create_payment: parsed.data.create_payment,
            cash_desk_id: parsed.data.cash_desk_id,
            payment_type: parsed.data.payment_type
          }
        );
        return reply.send({ data: detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ERR";
        if (sendDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/:id/reassign",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const parsed = bankTransferReassignBodySchema.safeParse(request.body);
      if (!Number.isFinite(id) || id < 1 || !parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid request",
          parsed.success ? undefined : zodValidationExtras(parsed.error)
        );
      }
      try {
        const detail = await reassignInboxClient(
          request.tenant!.id,
          id,
          parsed.data.client_id,
          parsed.data.comment,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ERR";
        if (sendDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/:id/comment",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const parsed = bankTransferCommentBodySchema.safeParse(request.body);
      if (!Number.isFinite(id) || id < 1 || !parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid request");
      }
      try {
        const detail = await commentInboxItem(
          request.tenant!.id,
          id,
          parsed.data.comment,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ERR";
        if (sendDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/:id/ignore",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const parsed = bankTransferIgnoreBodySchema.safeParse(request.body ?? {});
      if (!Number.isFinite(id) || id < 1 || !parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid request");
      }
      try {
        const detail = await ignoreInboxItem(
          request.tenant!.id,
          id,
          parsed.data.comment,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ERR";
        if (sendDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/bank-transfer-inbox/:id/create-payment",
    { preHandler: [...pre], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      const parsed = bankTransferCreatePaymentBodySchema.safeParse(request.body ?? {});
      if (!Number.isFinite(id) || id < 1 || !parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid request");
      }
      try {
        const detail = await createPendingPaymentFromInbox(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request),
          {
            cash_desk_id: parsed.data.cash_desk_id,
            payment_type: parsed.data.payment_type
          }
        );
        return reply.code(201).send({ data: detail });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "ERR";
        if (sendDomainError(reply, request, msg)) return;
        throw e;
      }
    }
  );
}
