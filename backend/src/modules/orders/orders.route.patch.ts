import type { FastifyInstance } from "fastify";
import {
  bulkOrderExpeditorBodySchema,
  bulkOrderNakladnoyBodySchema,
  bulkOrderStatusBodySchema,
  createOrderBodySchema,
  ordersListQuerySchema,
  patchOrderLinesBodySchema,
  patchOrderMetaBodySchema,
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
  updateOrderStatus
} from "./orders.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export async function registerOrderPatchRoutes(app: FastifyInstance) {
  app.patch(
    "/api/:slug/orders/:id/meta",
    {
      preHandler: [
        jwtAccessVerify,
        requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_META_ANY)
      ]
    },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchOrderMetaBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await assertDocWritableById(request, "orders", id);
        const viewer = getAccessUser(request);
        const sub = Number.parseInt(viewer.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const row = await updateOrderMeta(
          request.tenant!.id,
          id,
          parsed.data,
          viewer.role,
          actorUserId
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ORDER_NOT_EDITABLE") {
          return sendApiError(reply, request, 400, "OrderNotEditable");
        }
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_AGENT") return sendApiError(reply, request, 400, "BadAgent");
        if (msg === "ORDER_REQUIRES_AGENT") {
          return sendApiError(reply, request, 400, "OrderRequiresAgent");
        }
        if (msg === "ORDER_REQUIRES_WAREHOUSE") {
          return sendApiError(reply, request, 400, "OrderRequiresWarehouse");
        }
        if (msg === "ORDER_REQUIRES_PAYMENT_METHOD") {
          return sendApiError(reply, request, 400, "OrderRequiresPaymentMethod");
        }
        if (msg === "BAD_EXPEDITOR") return sendApiError(reply, request, 400, "BadExpeditor");
        if (msg === "ORDER_REQUIRES_WAREHOUSE_FOR_BLOCK") {
          return sendApiError(reply, request, 400, "OrderRequiresWarehouseForBlock");
        }
        if (msg === "BAD_WAREHOUSE_BLOCK") return sendApiError(reply, request, 400, "BadWarehouseBlock");
        if (msg === "WAREHOUSE_BLOCK_WRONG_WAREHOUSE") {
          return sendApiError(reply, request, 400, "WarehouseBlockWrongWarehouse");
        }
        if (msg === "WAREHOUSE_BLOCK_NO_DRIVER") {
          return sendApiError(reply, request, 400, "WarehouseBlockNoDriver");
        }
        if (msg === "WAREHOUSE_BLOCK_AMBIGUOUS_DRIVER") {
          return sendApiError(reply, request, 400, "WarehouseBlockAmbiguousDriver");
        }
        if (msg === "ORDER_BLOCK_EXPEDITOR_MISMATCH") {
          return sendApiError(reply, request, 400, "OrderBlockExpeditorMismatch");
        }
        if (msg === "EMPTY_META_PATCH") {
          return sendApiError(reply, request, 400, "ValidationError");
        }
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/orders/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = patchOrderLinesBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await assertDocWritableById(request, "orders", id);
        const viewer = getAccessUser(request);
        const sub = Number.parseInt(viewer.sub, 10);
        const actorUserId = Number.isFinite(sub) && sub > 0 ? sub : null;
        const row = await updateOrderLines(
          request.tenant!.id,
          id,
          parsed.data,
          viewer.role,
          actorUserId
        );
        return reply.send(row);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ORDER_NOT_EDITABLE") {
          return sendApiError(reply, request, 400, "OrderNotEditable");
        }
        if (msg === "FORBIDDEN_OPERATOR_ORDER_LINES_EDIT") {
          return sendApiError(reply, request, 403, "ForbiddenOperatorOrderLinesEdit");
        }
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_AGENT") return sendApiError(reply, request, 400, "BadAgent");
        if (msg === "CONTRACT_AGENT_MISMATCH") {
          return sendApiError(reply, request, 409, "ContractAgentMismatch");
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
        if (msg === "CREDIT_LIMIT_EXCEEDED") {
          const ex = e as Error & { credit_limit?: string; outstanding?: string; order_total?: string };
          return sendApiError(reply, request, 400, "CreditLimitExceeded", undefined, {
            credit_limit: ex.credit_limit,
            outstanding: ex.outstanding,
            order_total: ex.order_total
          });
        }
        if (msg === "BAD_BONUS_GIFT_OVERRIDE") {
          return sendApiError(reply, request, 400, "BadBonusGiftOverride");
        }
        if (msg === "INSUFFICIENT_STOCK") {
          const ex = e as Error & { product_id?: number; available?: string; requested?: string };
          return sendApiError(reply, request, 400, "InsufficientStock", undefined, {
            product_id: ex.product_id,
            available: ex.available,
            requested: ex.requested
          });
        }
        throw e;
      }
    }
  );
}
