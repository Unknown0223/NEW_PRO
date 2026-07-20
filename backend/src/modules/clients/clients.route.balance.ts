import type { FastifyInstance } from "fastify";
import { catalogRoles } from "./clients.route.shared";

import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles, getAccessUser } from "../auth/auth.prehandlers";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { assertClientAllowedForActor } from "../access/access-agent-scope";
import { getClientBalanceLedger } from "./client-balance-ledger.service";
import { getClientDebtorCreditorMonthly } from "./client-debtor-creditor-report.service";
import {
  addClientBalanceMovement,
  listClientBalanceMovements
} from "./clients.service";
import {
  balanceMovementBodySchema,
  endOfLocalDay,
  parseLocalYmd
} from "./clients.route.schemas";

async function assertClientScope(
  request: Parameters<typeof getAccessUser>[0],
  tenantId: number,
  clientId: number
): Promise<void> {
  const viewer = getAccessUser(request);
  await assertClientAllowedForActor(tenantId, clientId, {
    userId: actorUserIdOrNull(request),
    role: viewer.role ?? ""
  });
}

export async function registerClientBalanceRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/clients/:id/balance-ledger",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const pageNum = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const ledger_detail = q.ledger_detail === "1" || q.ledger_detail === "true";
      const maxLedgerLimit = ledger_detail ? 5000 : 100;
      const limitNum = Math.min(
        maxLedgerLimit,
        Math.max(1, Number.parseInt(q.limit ?? "20", 10) || 20)
      );
      const search = q.search?.trim() || undefined;
      const lkRaw = q.ledger_kind?.trim();
      const ledger_kind =
        lkRaw === "debt" || lkRaw === "payment" ? lkRaw : ("all" as const);
      const noAgent = q.no_agent === "1" || q.no_agent === "true";
      let filter_agent_ids: number[] = [];
      const rawIds = q.agent_ids?.trim();
      if (rawIds) {
        for (const part of rawIds.split(/[,;]+/)) {
          const t = part.trim();
          if (!t) continue;
          const n = Number.parseInt(t, 10);
          if (Number.isFinite(n) && n > 0) filter_agent_ids.push(n);
        }
        filter_agent_ids = [...new Set(filter_agent_ids)];
      }
      let filter_agent_id: number | null = null;
      if (filter_agent_ids.length === 0 && q.agent_id?.trim()) {
        const aid = Number.parseInt(q.agent_id.trim(), 10);
        if (!Number.isFinite(aid) || aid <= 0) {
          return sendApiError(reply, request, 400, "InvalidAgentId");
        }
        filter_agent_id = aid;
      }
      let dateFrom: Date | null = null;
      let dateToEnd: Date | null = null;
      if (q.date_from?.trim()) {
        const a = parseLocalYmd(q.date_from);
        if (!a) return sendApiError(reply, request, 400, "InvalidDate", undefined, { field: "date_from" });
        dateFrom = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0);
      }
      if (q.date_to?.trim()) {
        const b = parseLocalYmd(q.date_to);
        if (!b) return sendApiError(reply, request, 400, "InvalidDate", undefined, { field: "date_to" });
        dateToEnd = endOfLocalDay(b);
      }
      if (dateFrom && dateToEnd && dateFrom > dateToEnd) {
        return sendApiError(reply, request, 400, "BadDateRange");
      }
      try {
        await assertClientScope(request, request.tenant!.id, id);
        const result = await getClientBalanceLedger(request.tenant!.id, id, {
          page: pageNum,
          limit: limitNum,
          date_from: dateFrom,
          date_to_end: dateToEnd,
          search,
          ledger_kind,
          filter_agent_id: filter_agent_id ?? null,
          filter_agent_ids: filter_agent_ids.length > 0 ? filter_agent_ids : undefined,
          filter_no_agent: noAgent,
          ledger_detail
        });
        return reply.send(result);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "CLIENT_OUT_OF_SCOPE") {
          return sendApiError(reply, request, 403, "Forbidden", "Client outside agent scope");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id/debtor-creditor-monthly",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await assertClientScope(request, request.tenant!.id, id);
        const rows = await getClientDebtorCreditorMonthly(request.tenant!.id, id);
        return reply.send({ rows });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "CLIENT_OUT_OF_SCOPE") {
          return sendApiError(reply, request, 403, "Forbidden", "Client outside agent scope");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/clients/:id/balance-movements",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = request.query as Record<string, string | undefined>;
      const pageNum = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limitNum = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));
      let dateFrom: Date | null = null;
      let dateToEnd: Date | null = null;
      if (q.date_from?.trim()) {
        const a = parseLocalYmd(q.date_from);
        if (!a) return sendApiError(reply, request, 400, "InvalidDate", undefined, { field: "date_from" });
        dateFrom = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0);
      }
      if (q.date_to?.trim()) {
        const b = parseLocalYmd(q.date_to);
        if (!b) return sendApiError(reply, request, 400, "InvalidDate", undefined, { field: "date_to" });
        dateToEnd = endOfLocalDay(b);
      }
      try {
        await assertClientScope(request, request.tenant!.id, id);
        const result = await listClientBalanceMovements(request.tenant!.id, id, pageNum, limitNum, {
          date_from: dateFrom,
          date_to_end: dateToEnd
        });
        return reply.send(result);
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "CLIENT_OUT_OF_SCOPE") {
          return sendApiError(reply, request, 403, "Forbidden", "Client outside agent scope");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/clients/:id/balance-movements",
    { preHandler: [jwtAccessVerify, requireRoles("admin")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = balanceMovementBodySchema.safeParse(request.body);
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
      try {
        const actor = getAccessUser(request);
        const sub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const row = await addClientBalanceMovement(
          request.tenant!.id,
          id,
          parsed.data.delta,
          parsed.data.note ?? null,
          actorUserId
        );
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_DELTA") return sendApiError(reply, request, 400, "BadDelta");
        throw e;
      }
    }
  );
}
