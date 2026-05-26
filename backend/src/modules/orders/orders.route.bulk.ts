import type { FastifyInstance } from "fastify";
import {
  bulkOrderConsignmentBodySchema,
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
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { attachmentContentDisposition } from "../../lib/content-disposition";
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
  bulkUpdateOrderConsignment,
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

export async function registerOrderBulkRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/orders/bulk/status",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderStatusBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
      const result = await bulkUpdateOrderStatus(
        request.tenant!.id,
        parsed.data.order_ids,
        parsed.data.status,
        actorUserId,
        actor.role,
        parsed.data.occurred_at
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/orders/bulk/expeditor",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderExpeditorBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
      const result = await bulkUpdateOrderExpeditor(
        request.tenant!.id,
        parsed.data.order_ids,
        parsed.data.expeditor_user_id,
        actorUserId,
        actor.role
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/orders/bulk/consignment",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderConsignmentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
      const result = await bulkUpdateOrderConsignment(
        request.tenant!.id,
        parsed.data.order_ids,
        parsed.data.is_consignment,
        parsed.data.consignment_due_date ?? null,
        actorUserId
      );
      return reply.send(result);
    }
  );

  app.post(
    "/api/:slug/orders/bulk/nakladnoy",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderNakladnoyBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const result = await requestBulkOrderNakladnoy(
          request.tenant!.id,
          parsed.data.order_ids,
          parsed.data.template,
          {
            codeColumn: parsed.data.code_column ?? "sku",
            separateSheets: parsed.data.separate_sheets ?? false,
            groupBy: parsed.data.group_by ?? "agent"
          },
          parsed.data.format ?? "xlsx",
          parsed.data.warehouse_layout ?? null
        );
        return reply
          .header(
            "Content-Type",
            result.format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          )
          .header("Content-Disposition", attachmentContentDisposition(result.filename))
          .send(result.buffer);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "ORDERS_NOT_FOUND") {
          const ex = e as Error & { missing_ids?: number[] };
          return sendApiError(reply, request, 400, "OrdersNotFound", undefined, { missing_ids: ex.missing_ids ?? [] });
        }
        if (msg === "EMPTY_ORDER_IDS") {
          return sendApiError(reply, request, 400, "EmptyOrderIds");
        }
        if (msg === "TOO_MANY_ORDERS") {
          return sendApiError(reply, request, 400, "TooManyOrders");
        }
        if (msg === "INVALID_NAKLADNOY_TEMPLATE") {
          return sendApiError(reply, request, 400, "InvalidNakladnoyTemplate");
        }
        if (msg === "INVALID_WAREHOUSE_LAYOUT" || msg === "WAREHOUSE_LAYOUT_XLSX_ONLY") {
          return sendApiError(reply, request, 400, "InvalidWarehouseLayout");
        }
        if (msg.startsWith("WAREHOUSE_TEMPLATE_ASSET_MISSING:")) {
          return sendApiError(reply, request, 500, "WarehouseTemplateMissing");
        }
        throw e;
      }
    }
  );
}
