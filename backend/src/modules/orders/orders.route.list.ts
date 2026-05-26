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

export async function registerOrderListRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/orders",
    { preHandler: [jwtAccessVerify, requireIfSkladchikThenAnyEntitlement(SKLADCHIK_ORDER_FLOW_ANY)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const qRaw = request.query as Record<string, string | undefined>;
      const selected = parseSelectedMastersFromQuery(qRaw);
      const parsedQuery = ordersListQuerySchema.safeParse(qRaw);
      if (!parsedQuery.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsedQuery.error));
      }
      const q = parsedQuery.data;
      const viewer = getAccessUser(request);
      const viewerId = Number.parseInt(String(viewer.sub ?? ""), 10);
      const result = await listOrdersPaged(
        request.tenant!.id,
        {
          page: q.page,
          limit: q.limit,
          status: q.status,
          client_id: q.client_id,
          search: q.search,
          warehouse_id: q.warehouse_id ?? (selected.selected_warehouse_id ?? undefined),
          agent_id: q.agent_ids?.length ? undefined : q.agent_id ?? (selected.selected_agent_id ?? undefined),
          agent_ids: q.agent_ids,
          include_no_agent: q.include_no_agent,
          expeditor_user_id: q.expeditor_user_id ?? (selected.selected_expeditor_user_id ?? undefined),
          client_category: q.client_category,
          client_region: q.client_region,
          client_city: q.client_city,
          client_zone: q.client_zone,
          agent_trade_direction: q.agent_trade_direction,
          product_id: q.product_id,
          date_from: q.date_from,
          date_to: q.date_to,
          date_mode: q.date_mode,
          order_type: q.order_type,
          is_consignment: q.is_consignment,
          product_category_id: q.product_category_id,
          payment_type: q.payment_type,
          payment_method_ref: q.payment_method_ref,
          request_type_ref: q.request_type_ref,
          list_price_type: q.list_price_type,
          visit_weekday: q.visit_weekday,
          cursor: q.cursor
        },
        viewer.role ?? "",
        Number.isFinite(viewerId) && viewerId > 0 ? viewerId : null
      );
      return reply.send(result);
    }
  );
}
