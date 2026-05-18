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

export async function registerOrderCatalogRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/orders/create-context",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const selected = parseSelectedMastersFromQuery(q);
      if (process.env.ORDER_CREATE_CONTEXT_DEBUG === "1") {
        // eslint-disable-next-line no-console
        console.info("[order-create-context-debug] request.query", {
          tenantId: request.tenant!.id,
          selected,
          raw: {
            selected_client_id: q.selected_client_id ?? null,
            selected_agent_id: q.selected_agent_id ?? null,
            selected_warehouse_id: q.selected_warehouse_id ?? null,
            selected_expeditor_user_id: q.selected_expeditor_user_id ?? null
          }
        });
      }
      const bundle = await getOrderCreateContextBundle(request.tenant!.id, selected);
      return reply.send(bundle);
    }
  );

  app.get(
    "/api/:slug/orders/create-catalog",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const selected = parseSelectedMastersFromQuery(q);
      const bundle = await getOrderCreateCatalogBundle(request.tenant!.id, selected);
      return reply.send(bundle);
    }
  );

  /** Obmen manbalari: polki qoldiq − avvalgi obmen minuslari (har `order_id`+`product_id`). */
  app.get(
    "/api/:slug/orders/exchange-source-availability",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const clientId = Number.parseInt(q.client_id ?? "0", 10);
      if (!Number.isFinite(clientId) || clientId < 1) {
        return sendApiError(reply, request, 400, "ClientIdRequired");
      }
      const selected = parseSelectedMastersFromQuery(q);
      const scope = await resolveConstraintScope(request.tenant!.id, selected);
      if (scope.constrained && !scope.client_ids.includes(clientId)) {
        return sendApiError(reply, request, 400, "BadClientScope");
      }
      const raw = q.order_ids?.trim();
      if (!raw) {
        return sendApiError(reply, request, 400, "OrderIdsRequired");
      }
      const parsed = raw
        .split(/[, ]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const uniq = [...new Set(parsed)];
      if (uniq.length < 1) {
        return sendApiError(reply, request, 400, "OrderIdsRequired");
      }
      try {
        const data = await getExchangeSourceAvailability(request.tenant!.id, clientId, uniq);
        return reply.send({ data });
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (code === "BAD_ORDER" || code === "ORDER_NOT_DELIVERED") {
          return sendApiError(reply, request, 400, "BadOrder", "Barcha manba zakazlar yetkazilgan (delivered) bo'lishi kerak.");
        }
        throw e;
      }
    }
  );
}
