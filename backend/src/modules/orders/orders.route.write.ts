import type { FastifyInstance } from "fastify";
import {
  bulkOrderExpeditorBodySchema,
  bulkOrderNakladnoyBodySchema,
  bulkOrderStatusBodySchema,
  createOrderBodySchema,
  ordersListQuerySchema,
  patchOrderLinesBodySchema,
  patchOrderMetaBodySchema,
  patchOrderMilestoneAtBodySchema,
  patchOrderStatusBodySchema
} from "../../contracts/orders.schemas";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { getErrorCode } from "../../lib/app-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableById } from "../../lib/document-edit-lock.request";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  requireIfSkladchikThenAnyEntitlement,
  requireRolesOrSkladchikAnyEntitlement,
  SKLADCHIK_ORDER_FLOW_ANY,
  SKLADCHIK_ORDER_META_ANY
} from "../staff/skladchik-access.prehandler";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "../linkage/linkage.service";
import { getExchangeSourceAvailability } from "./exchange-source-limits.service";
import { getOrderCreateCatalogBundle, getOrderCreateContextBundle } from "./order-create-context.service";
import {
  bulkUpdateOrderExpeditor,
  bulkUpdateOrderStatus,
  createOrder,
  getOrderDetail,
  listOrdersPaged,
  requestBulkOrderNakladnoy,
  updateOrderLines,
  updateOrderMeta,
  updateOrderMilestoneAt,
  updateOrderStatus
} from "./orders.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export async function registerOrderWriteRoutes(app: FastifyInstance) {
  app.patch(
    "/api/:slug/orders/:id/status",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchOrderStatusBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await assertDocWritableById(request, "orders", id);
        const actor = getAccessUser(request);
        const actorSub = Number.parseInt(actor.sub, 10);
        const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
        const row = await updateOrderStatus(
          request.tenant!.id,
          id,
          parsed.data.status,
          actorUserId,
          actor.role,
          parsed.data.occurred_at
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = getErrorCode(e) ?? "";
        if (msg === "INVALID_OCCURRED_AT") {
          return sendApiError(reply, request, 400, "InvalidOccurredAt");
        }
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "FORBIDDEN_REVERT") {
          return sendApiError(reply, request, 403, "ForbiddenRevert");
        }
        if (msg === "FORBIDDEN_REOPEN_CANCELLED") {
          return sendApiError(reply, request, 403, "ForbiddenReopenCancelled");
        }
        if (msg === "FORBIDDEN_OPERATOR_CANCEL_LATE") {
          return sendApiError(reply, request, 403, "ForbiddenOperatorCancelLate");
        }
        if (msg === "INVALID_STATUS") return sendApiError(reply, request, 400, "InvalidStatus");
        if (msg === "INVALID_TRANSITION") {
          const ex = e as Error & { from?: string; to?: string };
          return sendApiError(reply, request, 400, "InvalidTransition", undefined, {
            from: ex.from,
            to: ex.to
          });
        }
        if (msg === "APPROVAL_PENDING") {
          return sendApiError(reply, request, 409, "ApprovalPending");
        }
        if (msg === "APPROVAL_REJECTED") {
          return sendApiError(reply, request, 409, "ApprovalRejected");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/orders/:id/milestone-at",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchOrderMilestoneAtBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await assertDocWritableById(request, "orders", id);
        const actor = getAccessUser(request);
        const row = await updateOrderMilestoneAt(
          request.tenant!.id,
          id,
          parsed.data.milestone,
          parsed.data.occurred_at,
          actor.role
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "MILESTONE_NOT_FOUND") {
          return sendApiError(reply, request, 404, "MilestoneNotFound");
        }
        if (msg === "INVALID_STATUS" || msg === "INVALID_OCCURRED_AT") {
          return sendApiError(reply, request, 400, "ValidationError");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createOrderBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const viewer = getAccessUser(request);
        const row = await createOrder(request.tenant!.id, parsed.data, {
          role: viewer.role,
          userId: Number.parseInt(viewer.sub, 10) || undefined
        });
        return reply.status(201).send(row);
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_AGENT") return sendApiError(reply, request, 400, "BadAgent");
        if (msg === "CONTRACT_AGENT_MISMATCH") {
          return sendApiError(reply, request, 409, "ContractAgentMismatch");
        }
        if (msg === "BRANCH_SCOPE_VIOLATION") {
          return sendApiError(reply, request, 403, "BranchScopeViolation");
        }
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        if (msg === "DUPLICATE_PRODUCT") return sendApiError(reply, request, 400, "DuplicateProduct");
        if (msg === "EMPTY_ITEMS") return sendApiError(reply, request, 400, "EmptyItems");
        if (msg === "NO_PRICE") {
          const ex = e as Error & { product_id?: number; price_type?: string };
          return sendApiError(reply, request, 400, "NoPrice", undefined, {
            product_id: ex.product_id,
            price_type: ex.price_type ?? "retail"
          });
        }
        if (msg === "INSUFFICIENT_STOCK") {
          const ex = e as Error & { product_id?: number; available?: string; requested?: string };
          return sendApiError(reply, request, 400, "InsufficientStock", undefined, {
            product_id: ex.product_id,
            available: ex.available,
            requested: ex.requested
          });
        }
        if (msg === "BAD_EXPEDITOR") {
          return sendApiError(reply, request, 400, "BadExpeditor");
        }
        if (msg === "CREDIT_LIMIT_EXCEEDED") {
          const ex = e as Error & { credit_limit?: string; outstanding?: string; order_total?: string };
          return sendApiError(reply, request, 400, "CreditLimitExceeded", undefined, {
            credit_limit: ex.credit_limit,
            outstanding: ex.outstanding,
            order_total: ex.order_total
          });
        }
        if (msg === "ORDER_BLOCKED_BY_DEBT") {
          return sendApiError(
            reply,
            request,
            400,
            "OrderBlockedByDebt",
            "Заказ запрещён: у клиента есть долг"
          );
        }
        if (msg === "CONSIGNMENT_CLIENT_DISABLED") {
          return sendApiError(
            reply,
            request,
            400,
            "ConsignmentClientDisabled",
            "Консигнационные заказы для этого клиента запрещены"
          );
        }
        if (msg === "CONSIGNMENT_BLOCKED_BY_DEBT") {
          return sendApiError(
            reply,
            request,
            400,
            "ConsignmentBlockedByDebt",
            "Консигнация запрещена: есть долг по консигнации"
          );
        }
        if (msg === "ORDER_RESTRICTED") {
          const ex = e as Error & { rule_id?: number; rule_name?: string };
          const detail = ex.rule_name
            ? `Заказ заблокирован правилом: ${ex.rule_name}`
            : "Заказ заблокирован правилом ограничения";
          return sendApiError(reply, request, 403, "OrderRestricted", detail, {
            rule_id: ex.rule_id,
            rule_name: ex.rule_name
          });
        }
        if (msg === "ORDER_REQUIRES_AGENT") {
          return sendApiError(reply, request, 400, "OrderRequiresAgent");
        }
        if (msg === "ORDER_REQUIRES_WAREHOUSE") {
          return sendApiError(reply, request, 400, "OrderRequiresWarehouse");
        }
        if (msg === "ORDER_REQUIRES_PAYMENT_METHOD") {
          return sendApiError(reply, request, 400, "OrderRequiresPaymentMethod");
        }
        if (msg === "CONSIGNMENT_REQUIRES_AGENT") {
          return sendApiError(reply, request, 400, "ConsignmentRequiresAgent");
        }
        if (msg === "CONSIGNMENT_AGENT_DISABLED") {
          return sendApiError(reply, request, 400, "ConsignmentAgentDisabled");
        }
        if (msg === "CONSIGNMENT_LIMIT_EXCEEDED") {
          const ex = e as Error & {
            consignment_limit?: string;
            outstanding?: string;
            order_total?: string;
          };
          return sendApiError(reply, request, 400, "ConsignmentLimitExceeded", undefined, {
            consignment_limit: ex.consignment_limit,
            outstanding: ex.outstanding,
            order_total: ex.order_total
          });
        }
        if (msg === "BAD_CONSIGNMENT_DUE_DATE") {
          return sendApiError(reply, request, 400, "BadConsignmentDueDate");
        }
        if (msg === "BAD_BONUS_GIFT_OVERRIDE") {
          return sendApiError(reply, request, 400, "BadBonusGiftOverride");
        }
        if (msg === "EXCHANGE_PAYLOAD_REQUIRED") {
          return sendApiError(reply, request, 400, "ExchangePayloadRequired");
        }
        if (msg === "EXCHANGE_REQUIRES_AGENT") {
          return sendApiError(reply, request, 400, "ExchangeRequiresAgent");
        }
        if (msg === "EXCHANGE_SOURCE_ORDERS_REQUIRED") {
          return sendApiError(reply, request, 400, "ExchangeSourceOrdersRequired");
        }
        if (msg === "EXCHANGE_LINES_REQUIRED") {
          return sendApiError(reply, request, 400, "ExchangeLinesRequired");
        }
        if (msg === "EXCHANGE_DUPLICATE_MINUS_LINE") {
          return sendApiError(reply, request, 400, "ExchangeDuplicateMinusLine");
        }
        if (msg === "EXCHANGE_DUPLICATE_PLUS_LINE") {
          return sendApiError(reply, request, 400, "ExchangeDuplicatePlusLine");
        }
        if (msg === "EXCHANGE_MINUS_ORDER_NOT_IN_SOURCE") {
          return sendApiError(reply, request, 400, "ExchangeMinusOrderNotInSource");
        }
        if (msg === "EXCHANGE_MINUS_OVER_LIMIT") {
          const ex = e as Error & { order_id?: number; product_id?: number; max_qty?: string };
          return sendApiError(reply, request, 400, "ExchangeMinusOverLimit", undefined, {
            order_id: ex.order_id,
            product_id: ex.product_id,
            max_qty: ex.max_qty
          });
        }
        if (msg === "EXCHANGE_NO_INTERCHANGEABLE_GROUP") {
          return sendApiError(reply, request, 400, "ExchangeNoInterchangeableGroup");
        }
        if (msg === "EXCHANGE_INTERCHANGEABLE_INCOMPLETE") {
          return sendApiError(reply, request, 400, "ExchangeInterchangeableIncomplete");
        }
        if (msg === "EXCHANGE_PRICE_TYPE_NOT_IN_GROUP") {
          return sendApiError(reply, request, 400, "ExchangePriceTypeNotInGroup");
        }
        if (msg === "EXCHANGE_MINUS_NOT_IN_GROUP") {
          return sendApiError(reply, request, 400, "ExchangeMinusNotInGroup");
        }
        if (msg === "EXCHANGE_PLUS_NOT_INTERCHANGEABLE") {
          const ex = e as Error & { product_id?: number };
          return sendApiError(reply, request, 400, "ExchangePlusNotInterchangeable", undefined, {
            product_id: ex.product_id
          });
        }
        if (msg === "EXCHANGE_BAD_SOURCE_LINE") {
          return sendApiError(reply, request, 400, "ExchangeBadSourceLine");
        }
        if (msg === "LINKAGE_CLIENT_FORBIDDEN") {
          return sendApiError(reply, request, 403, "LinkageClientForbidden");
        }
        if (msg === "LINKAGE_WAREHOUSE_FORBIDDEN") {
          return sendApiError(reply, request, 403, "LinkageWarehouseForbidden");
        }
        if (msg === "LINKAGE_PRODUCT_FORBIDDEN") {
          const ex = e as Error & { product_id?: number };
          return sendApiError(reply, request, 403, "LinkageProductForbidden", undefined, {
            product_id: ex.product_id
          });
        }
        throw e;
      }
    }
  );
}
