import type { FastifyInstance } from "fastify";
import {
  consignmentAutoCandidatesQuerySchema,
  consignmentAutoConvertBodySchema,
  consignmentAutoSettingsPatchSchema,
  consignmentTransfersListQuerySchema,
  ordersListQuerySchema
} from "../../contracts/orders.schemas";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableById } from "../../lib/document-edit-lock.request";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  requireIfSkladchikThenAnyEntitlement,
  SKLADCHIK_ORDER_FLOW_ANY
} from "../staff/skladchik-access.prehandler";
import { parseSelectedMastersFromQuery } from "../linkage/linkage.service";
import {
  convertConsignmentAutoCandidates,
  getConsignmentAutoSettings,
  listConsignmentAutoCandidates,
  listConsignmentTransfers,
  listConsignmentTransfersForExport,
  listOrdersPaged,
  patchConsignmentAutoSettings
} from "./orders.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export async function registerOrderListRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/orders/consignment-auto/settings",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await getConsignmentAutoSettings(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.patch(
    "/api/:slug/orders/consignment-auto/settings",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = consignmentAutoSettingsPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const data = await patchConsignmentAutoSettings(request.tenant!.id, parsed.data);
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_AUTO_DAYS") return sendApiError(reply, request, 400, "BadAutoDays");
        if (msg === "TENANT_NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/orders/consignment-auto/candidates",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = consignmentAutoCandidatesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const data = await listConsignmentAutoCandidates(request.tenant!.id, parsed.data);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/orders/consignment-auto/convert",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = consignmentAutoConvertBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
      try {
        for (const orderId of parsed.data.order_ids) {
          await assertDocWritableById(request, "orders", orderId);
        }
        const result = await convertConsignmentAutoCandidates(
          request.tenant!.id,
          parsed.data,
          actorUserId
        );
        return reply.send(result);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/orders/consignment-transfers",
    { preHandler: [jwtAccessVerify, requireIfSkladchikThenAnyEntitlement(SKLADCHIK_ORDER_FLOW_ANY)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = consignmentTransfersListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const data = await listConsignmentTransfers(request.tenant!.id, parsed.data);
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_DATE_FROM" || msg === "BAD_DATE_TO" || msg === "BAD_DATE_RANGE") {
          return sendApiError(reply, request, 400, "BadDateRange");
        }
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/orders/consignment-transfers/export-rows",
    { preHandler: [jwtAccessVerify, requireIfSkladchikThenAnyEntitlement(SKLADCHIK_ORDER_FLOW_ANY)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = consignmentTransfersListQuerySchema
        .omit({ page: true, page_size: true })
        .safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const rows = await listConsignmentTransfersForExport(request.tenant!.id, parsed.data);
        return reply.send({ data: { rows } });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_DATE_FROM" || msg === "BAD_DATE_TO" || msg === "BAD_DATE_RANGE") {
          return sendApiError(reply, request, 400, "BadDateRange");
        }
        throw e;
      }
    }
  );

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
          cursor: q.cursor,
          discount_alert: q.discount_alert,
          bonus_alert: q.bonus_alert,
          order_alert: q.order_alert
        },
        viewer.role ?? "",
        Number.isFinite(viewerId) && viewerId > 0 ? viewerId : null
      );
      return reply.send(result);
    }
  );
}
