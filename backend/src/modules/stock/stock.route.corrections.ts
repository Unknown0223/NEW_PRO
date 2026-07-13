import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableByDate } from "../../lib/document-edit-lock.request";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { applyStockAdjustment } from "./stock.service";
import {
  createWarehouseCorrectionBulk,
  listCorrectionWorkspaceRows,
  listDistinctPriceTypesForTenant,
  listWarehouseCorrections
} from "./warehouse-correction.service";
import {
  adjustmentBody,
  correctionBulkBodySchema,
  correctionsQuerySchema,
  correctionWorkspaceQuerySchema
} from "./stock.route.schemas";


export async function registerStockCorrectionRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock/correction-price-types",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(adminRoles, "correction_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const types = await listDistinctPriceTypesForTenant(request.tenant!.id);
      return reply.send({ data: types });
    }
  );

  app.get(
    "/api/:slug/stock/corrections",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(adminRoles, "correction_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = correctionsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      const q = parsed.data;
      const result = await listWarehouseCorrections(request.tenant!.id, {
        warehouse_id: q.warehouse_id,
        kind: q.kind,
        q: q.q,
        page: q.page,
        limit: q.limit
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/stock/correction-workspace",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(adminRoles, "correction_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = correctionWorkspaceQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        request.log.warn(
          {
            op: "correction_workspace_query_invalid",
            tenantId: request.tenant?.id,
            details: parsed.error.flatten(),
            query: request.query
          },
          "correction_workspace validation failed"
        );
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      const q = parsed.data;
      const scope =
        q.catalog_group_id != null
          ? ({ kind: "catalog_group" as const, id: q.catalog_group_id })
          : ({ kind: "category" as const, id: q.category_id! });
      try {
        const data = await listCorrectionWorkspaceRows(
          request.tenant!.id,
          q.warehouse_id,
          scope,
          q.price_type?.trim() || null
        );
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") {
          request.log.warn(
            {
              op: "correction_workspace_bad_warehouse",
              tenantId: request.tenant?.id,
              warehouse_id: q.warehouse_id
            },
            "correction_workspace warehouse not in tenant"
          );
          return sendApiError(reply, request, 400, "BadWarehouse");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/stock/corrections/bulk",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(adminRoles, "correction_add")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = correctionBulkBodySchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.warn(
          {
            op: "correction_bulk_body_invalid",
            tenantId: request.tenant?.id,
            details: parsed.error.flatten()
          },
          "corrections/bulk validation failed"
        );
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        if (parsed.data.occurred_at) {
          const occurredAt = new Date(parsed.data.occurred_at);
          if (!Number.isNaN(occurredAt.getTime())) {
            await assertDocWritableByDate(request, "stock", occurredAt, null, "correction");
          }
        }
        const result = await createWarehouseCorrectionBulk(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        request.log.info(
          {
            op: "correction_bulk_http_ok",
            tenantId: request.tenant?.id,
            documentId: result.id,
            line_count: parsed.data.items.length,
            kind: parsed.data.kind
          },
          "corrections/bulk created"
        );
        return reply.status(201).send(result);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_DELTA") return sendApiError(reply, request, 400, "BadDelta");
        if (msg === "NEGATIVE_QTY") return sendApiError(reply, request, 400, "NegativeQty");
        if (msg === "BELOW_RESERVED") return sendApiError(reply, request, 400, "BelowReserved");
        if (msg === "EMPTY_ITEMS") return sendApiError(reply, request, 400, "EmptyItems");
        if (msg === "TOO_MANY_LINES") return sendApiError(reply, request, 400, "TooManyLines");
        if (msg === "BAD_KIND") return sendApiError(reply, request, 400, "BadKind");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/stock/adjustment",
    { preHandler: [jwtAccessVerify, requireRoles(...adminRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = adjustmentBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const result = await applyStockAdjustment(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(200).send({ ok: true, ...result });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_DELTA") return sendApiError(reply, request, 400, "BadDelta");
        if (msg === "NEGATIVE_QTY") return sendApiError(reply, request, 400, "NegativeQty");
        if (msg === "BELOW_RESERVED") return sendApiError(reply, request, 400, "BelowReserved");
        throw e;
      }
    }
  );
}
