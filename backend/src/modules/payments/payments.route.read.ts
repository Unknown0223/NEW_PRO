import type { FastifyInstance } from "fastify";
import {
  batchConfirmPaymentsBodySchema,
  createPaymentBodySchema,
  deletePaymentQuerySchema,
  parseOptPositiveInt,
  parsePaymentsListQuery,
  patchPaymentBodySchema,
  rejectPaymentBodySchema
} from "../../contracts/payments.schemas";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
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
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
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
        const row = await createPayment(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (msg === "BAD_AMOUNT") return sendApiError(reply, request, 400, "BadAmount");
        if (msg === "BAD_PAYMENT_TYPE") return sendApiError(reply, request, 400, "BadPaymentType");
        if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 400, "BadCashDesk");
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
