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
export async function registerPaymentWriteRoutes(app: FastifyInstance) {
  app.patch(
    "/api/:slug/payments/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchPaymentBodySchema.safeParse(request.body);
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
        const payload = await updatePayment(tenantId, id, parsed.data, actorUserIdOrNull(request));
        return reply.send(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "PAYMENT_VOIDED") return sendApiError(reply, request, 409, "PaymentVoided");
        if (msg === "EMPTY_PATCH") return sendApiError(reply, request, 400, "ValidationError", "Empty patch");
        if (msg === "BAD_AMOUNT") return sendApiError(reply, request, 400, "BadAmount");
        if (msg === "BAD_PAYMENT_TYPE") return sendApiError(reply, request, 400, "BadPaymentType");
        if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 400, "BadCashDesk");
        if (msg === "BAD_PAID_AT") return sendApiError(reply, request, 400, "BadPaidAt");
        if (msg === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (msg === "BAD_EXPEDITOR") return sendApiError(reply, request, 400, "BadExpeditor");
        if (msg === "BAD_EXPEDITOR_SCOPE") return sendApiError(reply, request, 400, "BadExpeditorScope");
        if (msg === "BAD_LEDGER_AGENT") return sendApiError(reply, request, 400, "BadLedgerAgent");
        if (msg === "AMOUNT_BELOW_ALLOCATED") {
          return sendApiError(reply, request, 400, "AmountBelowAllocated");
        }
        if (msg === "ORDER_LOCKED_BY_ALLOCATIONS") {
          return sendApiError(reply, request, 400, "OrderLockedByAllocations");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/:id/allocate",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const viewer = getAccessUser(request);
      const uid = Number.parseInt(viewer.sub, 10);
      try {
        const data = await allocatePayment(
          tenantId,
          id,
          Number.isFinite(uid) && uid > 0 ? uid : null
        );
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "PAYMENT_NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "PAYMENT_VOIDED") return sendApiError(reply, request, 409, "PaymentVoided");
        if (msg === "TENANT_NOT_FOUND") return sendApiError(reply, request, 404, "TenantNotFound");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/:id/confirm",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await confirmPendingPayment(tenantId, id, actorUserIdOrNull(request));
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_PENDING") {
          return sendApiError(
            reply,
            request,
            409,
            "NotPending",
            "Запись не в статусе «ожидание подтверждения»."
          );
        }
        if (msg === "BAD_ENTRY_KIND") return sendApiError(reply, request, 400, "BadEntryKind");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/:id/reject",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = rejectPaymentBodySchema.safeParse(request.body ?? {});
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
        await rejectPendingPayment(tenantId, id, actorUserIdOrNull(request), parsed.data.reason ?? null);
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_PENDING") {
          return sendApiError(
            reply,
            request,
            409,
            "NotPending",
            "Запись не в статусе «ожидание подтверждения»."
          );
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/batch-confirm",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = batchConfirmPaymentsBodySchema.safeParse(request.body ?? {});
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
      const result = await confirmPendingPaymentsBatch(
        request.tenant!.id,
        parsed.data.ids,
        actorUserIdOrNull(request)
      );
      return reply.send(result);
    }
  );

  app.delete(
    "/api/:slug/payments/:id",
    { preHandler: [jwtAccessVerify, requireRoles("admin")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = deletePaymentQuerySchema.parse((request.query as Record<string, unknown>) ?? {});
      try {
        await deletePayment(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request),
          q.cancel_reason_ref?.trim() || null
        );
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/:id/restore",
    { preHandler: [jwtAccessVerify, requireRoles("admin")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await restorePayment(request.tenant!.id, id, actorUserIdOrNull(request));
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
        throw e;
      }
    }
  );
}
