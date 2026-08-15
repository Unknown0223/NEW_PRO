import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import {
  assertDocWritableByDate,
  assertDocWritableById
} from "../../lib/document-edit-lock.request";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import {
  assertOrderAgentAllowedForActor,
  enrichScopedReportActor
} from "../access/access-agent-scope";
import { jwtAccessVerify, getAccessUser } from "../auth/auth.prehandlers";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  restoreExpense,
  approveExpense,
  rejectExpense,
  getExpense,
  getExpenseSummary,
  getPnlReport
} from "./expenses.service";

function parseExpenseDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "string" && raw.trim()) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export async function registerExpenseRoutes(app: FastifyInstance) {
  const preHandler = [jwtAccessVerify];

  app.get("/api/:slug/expenses", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const archiveRaw = q.archive?.trim().toLowerCase();
    const archive = archiveRaw === "true" || archiveRaw === "1" || archiveRaw === "yes";
    const jwtUser = getAccessUser(request);
    const actor = await enrichScopedReportActor(request.tenant!.id, {
      userId: actorUserIdOrNull(request),
      role: jwtUser.role ?? ""
    });
    const data = await listExpenses(
      request.tenant!.id,
      {
        page: q.page ? parseInt(q.page) : 1,
        limit: q.limit ? parseInt(q.limit) : 20,
        status: q.status,
        expense_type: q.type,
        agent_id: q.agentId ? parseInt(q.agentId) : undefined,
        warehouse_id: q.warehouseId ? parseInt(q.warehouseId) : undefined,
        from: q.from,
        to: q.to,
        archive
      },
      actor
    );
    return reply.send(data);
  });

  app.get("/api/:slug/expenses/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const data = await getExpense(request.tenant!.id, parseInt((request.params as any).id));
    return reply.send(data);
  });

  app.post("/api/:slug/expenses", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const jwtUser = getAccessUser(request);
    const body = request.body as Record<string, unknown>;
    try {
      const expenseDate = parseExpenseDate(body?.expense_date);
      if (expenseDate) {
        await assertDocWritableByDate(request, "expenses", expenseDate);
      }
      const agentId =
        typeof body?.agent_id === "number" && body.agent_id > 0
          ? body.agent_id
          : typeof body?.agentId === "number" && body.agentId > 0
            ? body.agentId
            : null;
      if (agentId != null) {
        await assertOrderAgentAllowedForActor(request.tenant!.id, agentId, {
          userId: actorUserIdOrNull(request),
          role: jwtUser.role ?? ""
        });
      }
      const data = await createExpense(request.tenant!.id, body as any, Number(jwtUser.sub));
      return reply.status(201).send(data);
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AGENT_OUT_OF_SCOPE") return sendApiError(reply, request, 403, "AgentOutOfScope");
      throw e;
    }
  });

  app.patch("/api/:slug/expenses/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const jwtUser = getAccessUser(request);
    const id = parseInt((request.params as any).id);
    const body = request.body as Record<string, unknown>;
    try {
      await assertDocWritableById(request, "expenses", id);
      const agentId =
        typeof body?.agent_id === "number" && body.agent_id > 0
          ? body.agent_id
          : typeof body?.agentId === "number" && body.agentId > 0
            ? body.agentId
            : null;
      if (agentId != null) {
        await assertOrderAgentAllowedForActor(request.tenant!.id, agentId, {
          userId: actorUserIdOrNull(request),
          role: jwtUser.role ?? ""
        });
      }
      const data = await updateExpense(request.tenant!.id, id, body as any, Number(jwtUser.sub));
      return reply.send(data);
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AGENT_OUT_OF_SCOPE") return sendApiError(reply, request, 403, "AgentOutOfScope");
      throw e;
    }
  });

  app.delete("/api/:slug/expenses/:id", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (Number.isNaN(id)) {
      return sendApiError(reply, request, 400, "InvalidId");
    }
    const q = z
      .object({ delete_reason_ref: z.string().max(128).optional() })
      .parse((request.query as Record<string, unknown>) ?? {});
    try {
      await assertDocWritableById(request, "expenses", id);
      await deleteExpense(
        request.tenant!.id,
        id,
        actorUserIdOrNull(request),
        q.delete_reason_ref?.trim() || null
      );
      return reply.status(204).send();
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
      if (msg === "CANNOT_DELETE_NON_DRAFT") return sendApiError(reply, request, 409, "CannotDeleteNonDraft");
      throw e;
    }
  });

  app.post("/api/:slug/expenses/:id/restore", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const id = Number.parseInt((request.params as { id: string }).id, 10);
    if (Number.isNaN(id) || id < 1) {
      return sendApiError(reply, request, 400, "InvalidId");
    }
    try {
      await assertDocWritableById(request, "expenses", id);
      await restoreExpense(request.tenant!.id, id, actorUserIdOrNull(request));
      return reply.status(204).send();
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      const msg = e instanceof Error ? e.message : "";
      if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
      if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
      if (msg === "CANNOT_RESTORE_NON_DRAFT") return sendApiError(reply, request, 409, "CannotRestoreNonDraft");
      throw e;
    }
  });

  app.post("/api/:slug/expenses/:id/approve", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const jwtUser = getAccessUser(request);
    const id = parseInt((request.params as any).id);
    try {
      await assertDocWritableById(request, "expenses", id);
      const data = await approveExpense(request.tenant!.id, id, Number(jwtUser.sub));
      return reply.send(data);
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      throw e;
    }
  });

  app.post("/api/:slug/expenses/:id/reject", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const jwtUser = getAccessUser(request);
    const body = request.body as { note?: string } | undefined;
    const id = parseInt((request.params as any).id);
    try {
      await assertDocWritableById(request, "expenses", id);
      const data = await rejectExpense(
        request.tenant!.id,
        id,
        Number(jwtUser.sub),
        body?.note ?? ""
      );
      return reply.send(data);
    } catch (e) {
      if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
      throw e;
    }
  });

  app.get("/api/:slug/expenses/summary", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await getExpenseSummary(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });

  app.get("/api/:slug/expenses/pnl", { preHandler }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const q = request.query as Record<string, string | undefined>;
    const data = await getPnlReport(request.tenant!.id, q.from, q.to);
    return reply.send(data);
  });
}
