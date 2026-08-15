import type { FastifyInstance } from "fastify";
import {
  batchConfirmPaymentsBodySchema,
  createPaymentBodySchema,
  deletePaymentQuerySchema,
  orderCashInContextQuerySchema,
  parseOptPositiveInt,
  parsePaymentsListQuery,
  patchPaymentBodySchema,
  rejectPaymentBodySchema
} from "../../contracts/payments.schemas";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableByDate } from "../../lib/document-edit-lock.request";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "../linkage/linkage.service";
import {
  createPayment,
  confirmPendingPayment,
  confirmPendingPaymentsBatch,
  deletePayment,
  getPaymentDetail,
  listPayments,
  listPaymentsForClient,
  listPaymentsForOrder,
  rejectPendingPayment,
  restorePayment,
  updatePayment
} from "./payments.service";
import {
  allocatePayment,
  getPaymentAllocations,
  listOpenOrdersForAllocation
} from "./payment-allocations.service";
import { getOrderCashInContext } from "./payment.order-cash-in";
import { listPaymentEditGrants } from "./payment-edit-grants.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;
export async function registerPaymentReadRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/payments",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const selected = parseSelectedMastersFromQuery(q);
      const scope = await resolveConstraintScope(request.tenant!.id, selected);
      const query = parsePaymentsListQuery(q);
      if (scope.constrained) {
        query.client_ids = scope.client_ids;
        query.cash_desk_ids = scope.cash_desk_ids;
        query.expeditor_user_ids = scope.expeditor_ids;
        query.warehouse_ids = scope.warehouse_ids;
      }
      const result = await listPayments(request.tenant!.id, query);
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/orders/:id/payments",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const data = await listPaymentsForOrder(request.tenant!.id, id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/clients/:id/payments",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const data = await listPaymentsForClient(request.tenant!.id, id, 100);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/payments",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createPaymentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid request body",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        if (parsed.data.paid_at) {
          const paidAt = new Date(parsed.data.paid_at);
          if (!Number.isNaN(paidAt.getTime())) {
            await assertDocWritableByDate(request, "payments", paidAt);
          }
        }
        const row = await createPayment(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (msg === "BAD_AMOUNT") return sendApiError(reply, request, 400, "BadAmount");
        if (msg === "BAD_PAYMENT_TYPE") return sendApiError(reply, request, 400, "BadPaymentType");
        if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 400, "BadCashDesk");
        if (msg === "CASH_DESK_NO_CLIENT_PAYMENTS") {
          return sendApiError(reply, request, 400, "CashDeskNoClientPayments");
        }
        if (msg === "CASH_DESK_NO_DISCOUNT_PAYMENTS") {
          return sendApiError(reply, request, 400, "CashDeskNoDiscountPayments");
        }
        if (msg === "BAD_EXPEDITOR") return sendApiError(reply, request, 400, "BadExpeditor");
        if (msg === "BAD_LEDGER_AGENT") return sendApiError(reply, request, 400, "BadLedgerAgent");
        if (msg === "BRANCH_SCOPE_VIOLATION") {
          return sendApiError(reply, request, 403, "BranchScopeViolation");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/payments/open-orders",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const clientId = parseOptPositiveInt(q.client_id);
      if (!clientId) {
        return sendApiError(reply, request, 400, "ClientIdRequired");
      }
      const modeRaw = q.mode?.trim().toLowerCase();
      const mode =
        modeRaw === "cash" || modeRaw === "consignment" || modeRaw === "none" ? modeRaw : "none";
      const agentId = parseOptPositiveInt(q.agent_id);
      const data = await listOpenOrdersForAllocation(request.tenant!.id, {
        client_id: clientId,
        agent_id: agentId ?? null,
        mode
      });
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/payments/order-cash-in/context",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = orderCashInContextQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      const orderIdsRaw = parsed.data.order_ids?.trim();
      const order_ids = orderIdsRaw
        ? orderIdsRaw
            .split(/[,]+/)
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        : undefined;
      try {
        const data = await getOrderCashInContext(request.tenant!.id, {
          client_id: parsed.data.client_id,
          order_ids
        });
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/payments/edit-grants",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(200, Math.max(1, Number.parseInt(q.limit ?? "10", 10) || 10));
      const accessUserId = parseOptPositiveInt(q.access_user_id);
      const statusRaw = q.status?.trim();
      let status: "completed" | "deleted" | "restored" | undefined;
      if (statusRaw === "completed" || statusRaw === "deleted" || statusRaw === "restored") {
        status = statusRaw;
      } else if (statusRaw === "COMPLETED") {
        status = "completed";
      } else if (statusRaw === "DELETED") {
        status = "deleted";
      } else if (statusRaw === "RESTORED") {
        status = "restored";
      }
      const payload = await listPaymentEditGrants(request.tenant!.id, {
        page,
        limit,
        date_from: q.date_from?.trim() || undefined,
        date_to: q.date_to?.trim() || undefined,
        status,
        access_user_id: accessUserId,
        cancel_reason_ref: q.cancel_reason_ref?.trim() || undefined,
        search: q.search?.trim() || undefined
      });
      return reply.send(payload);
    }
  );

  app.get(
    "/api/:slug/payments/:id/allocations",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const one = await prisma.payment.findFirst({ where: { id, tenant_id: tenantId }, select: { id: true } });
      if (!one) return sendApiError(reply, request, 404, "NotFound");
      const data = await getPaymentAllocations(tenantId, id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/payments/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const payload = await getPaymentDetail(tenantId, id);
      if (!payload) return sendApiError(reply, request, 404, "NotFound");
      return reply.send(payload);
    }
  );
}
