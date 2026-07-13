import type { FastifyInstance } from "fastify";
import {
  bulkOrderConsignmentBodySchema,
  bulkOrderExpeditorBodySchema,
  bulkOrderNakladnoyBodySchema,
  bulkOrderNakladnoyPreviewBodySchema,
  bulkOrderLoading520BodySchema,
  bulkOrderExpeditorLoadingBodySchema,
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
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
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
  nakladnoyBuildOptionsFromApi,
  requestBulkOrderNakladnoy,
  requestBulkOrderNakladnoyPreview,
  requestBulkOrderNakladnoyLoading520,
  requestBulkOrderNakladnoyExpeditorLoading,
  updateOrderLines,
  updateOrderMeta,
  updateOrderStatus
} from "./orders.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export async function registerOrderBulkRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/orders/bulk/status",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderStatusBodySchema.safeParse(request.body);
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
        const result = await bulkUpdateOrderStatus(
          request.tenant!.id,
          parsed.data.order_ids,
          parsed.data.status,
          actorUserId,
          actor.role,
          parsed.data.occurred_at
        );
        return reply.send(result);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders/bulk/expeditor",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderExpeditorBodySchema.safeParse(request.body);
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
        const result = await bulkUpdateOrderExpeditor(
          request.tenant!.id,
          parsed.data.order_ids,
          parsed.data.expeditor_user_id,
          actorUserId,
          actor.role
        );
        return reply.send(result);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders/bulk/consignment",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderConsignmentBodySchema.safeParse(request.body);
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
        const result = await bulkUpdateOrderConsignment(
          request.tenant!.id,
          parsed.data.order_ids,
          parsed.data.is_consignment,
          parsed.data.consignment_due_date ?? null,
          actorUserId,
          parsed.data.conditions_note ?? null
        );
        return reply.send(result);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders/bulk/nakladnoy",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)], ...writeApiRateLimitRouteOpts },
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
          nakladnoyBuildOptionsFromApi({
            code_column: parsed.data.code_column,
            separate_sheets: parsed.data.separate_sheets,
            group_by: parsed.data.group_by,
            warehouse_layout: parsed.data.warehouse_layout ?? null,
            warehouse_export_options: parsed.data.warehouse_export_options
          }),
          parsed.data.format ?? "xlsx",
          parsed.data.warehouse_layout ?? null,
          parsed.data.expeditor_loading_layout ?? null
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

  app.post(
    "/api/:slug/orders/bulk/nakladnoy/preview",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderNakladnoyPreviewBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const preview = await requestBulkOrderNakladnoyPreview(
          request.tenant!.id,
          parsed.data.order_ids,
          {
            template: parsed.data.template,
            label: parsed.data.label,
            warehouseLayout: parsed.data.warehouse_layout ?? null,
            expeditorLoadingLayout: parsed.data.expeditor_loading_layout ?? null,
            buildOptions: nakladnoyBuildOptionsFromApi({
              code_column: parsed.data.code_column,
              separate_sheets: parsed.data.separate_sheets,
              group_by: parsed.data.group_by,
              warehouse_layout: parsed.data.warehouse_layout ?? null,
              warehouse_export_options: parsed.data.warehouse_export_options
            })
          }
        );
        return reply.send(preview);
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
        if (msg === "PREVIEW_LAYOUT_NOT_SUPPORTED" || msg === "PREVIEW_PDF_NOT_SUPPORTED") {
          return sendApiError(reply, request, 400, "PreviewNotSupported");
        }
        if (
          msg === "INVALID_NAKLADNOY_TEMPLATE" ||
          msg === "INVALID_WAREHOUSE_LAYOUT" ||
          msg === "INVALID_EXPEDITOR_LOADING_LAYOUT" ||
          msg === "WAREHOUSE_LAYOUT_XLSX_ONLY" ||
          msg === "EXPEDITOR_LOADING_LAYOUT_XLSX_ONLY"
        ) {
          return sendApiError(reply, request, 400, "InvalidNakladnoyPreview");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders/bulk/nakladnoy/expeditor-loading",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderExpeditorLoadingBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const result = await requestBulkOrderNakladnoyExpeditorLoading(
          request.tenant!.id,
          parsed.data.order_ids,
          parsed.data.expeditor_loading_layout,
          nakladnoyBuildOptionsFromApi({
            code_column: parsed.data.code_column,
            separate_sheets: parsed.data.separate_sheets,
            group_by: parsed.data.group_by
          })
        );
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
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
        if (msg === "INVALID_EXPEDITOR_LOADING_LAYOUT") {
          return sendApiError(reply, request, 400, "InvalidExpeditorLoadingLayout");
        }
        if (msg.startsWith("EXPEDITOR_LOADING_TEMPLATE_ASSET_MISSING:")) {
          return sendApiError(reply, request, 500, "ExpeditorLoadingTemplateMissing");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders/bulk/nakladnoy/loading-520",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, SKLADCHIK_ORDER_FLOW_ANY)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = bulkOrderLoading520BodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        const result = await requestBulkOrderNakladnoyLoading520(
          request.tenant!.id,
          parsed.data.order_ids,
          {
            codeColumn: parsed.data.code_column ?? "sku",
            separateSheets: parsed.data.separate_sheets ?? false,
            groupBy: parsed.data.group_by ?? "agent"
          }
        );
        return reply
          .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
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
        throw e;
      }
    }
  );
}
