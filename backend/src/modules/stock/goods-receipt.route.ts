import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify } from "../auth/auth.prehandlers";
import {
  requireRolesOrSkladchikAnyEntitlement,
  requireRolesOrSkladchikEntitlement
} from "../staff/skladchik-access.prehandler";
import {
  createGoodsReceipt,
  deleteGoodsReceiptDraft,
  getGoodsReceiptDetail,
  listGoodsReceipts,
  restoreGoodsReceiptDraft,
  updateGoodsReceipt,
  updateGoodsReceiptStatus
} from "./goods-receipt.service";

const catalogRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor", "agent", "expeditor"] as const;
const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const receiptReadEntitlements = ["receipt_list", "receipt_add", "receipt_change", "receipt_confirm"] as const;
const receiptWriteEntitlements = ["receipt_add", "receipt_change", "receipt_confirm"] as const;

const listQuerySchema = z.object({
  warehouse_id: z.coerce.number().int().positive().optional(),
  supplier_id: z.coerce.number().int().positive().optional(),
  status: z.string().max(32).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  q: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(25),
  archive: z
    .preprocess(
      (val) =>
        val === true || val === "true" || val === "1" || val === "yes",
      z.boolean()
    )
    .optional()
    .default(false)
});

const lineSchema = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive(),
  unit_price: z.number().min(0).optional().nullable(),
  defect_qty: z.number().min(0).optional().nullable()
});

const createBodySchema = z.object({
  warehouse_id: z.number().int().positive(),
  supplier_id: z.number().int().positive().optional().nullable(),
  receipt_at: z.string().optional().nullable(),
  comment: z.string().max(4000).optional().nullable(),
  price_type: z.string().min(1).max(128),
  external_ref: z.string().max(128).optional().nullable(),
  status: z.enum(["draft", "posted"]).optional().default("posted"),
  lines: z.array(lineSchema).min(1)
});

const statusBodySchema = z.object({
  status: z.enum(["draft", "editing", "posted", "cancelled"])
});

const deleteQuerySchema = z.object({
  delete_reason_ref: z.string().max(128).optional()
});

export async function registerGoodsReceiptRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/goods-receipts",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, receiptReadEntitlements)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      const q = parsed.data;
      const result = await listGoodsReceipts(request.tenant!.id, {
        warehouse_id: q.warehouse_id,
        supplier_id: q.supplier_id,
        status: q.status,
        date_from: q.date_from,
        date_to: q.date_to,
        search: q.q,
        page: q.page,
        limit: q.limit,
        archive: q.archive
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/goods-receipts/:id",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(catalogRoles, receiptReadEntitlements)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await getGoodsReceiptDetail(request.tenant!.id, id);
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: row });
    }
  );

  app.post(
    "/api/:slug/goods-receipts/:id/status",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(writeRoles, receiptWriteEntitlements)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = statusBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const out = await updateGoodsReceiptStatus(
          request.tenant!.id,
          id,
          parsed.data.status,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: out });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "POSTED_IMMUTABLE") return sendApiError(reply, request, 409, "PostedImmutable");
        if (msg === "CANCELLED_IMMUTABLE") return sendApiError(reply, request, 409, "CancelledImmutable");
        throw e;
      }
    }
  );

  app.put(
    "/api/:slug/goods-receipts/:id",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(writeRoles, receiptWriteEntitlements)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const out = await updateGoodsReceipt(
          request.tenant!.id,
          id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.send({ data: out });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "POSTED_IMMUTABLE") return sendApiError(reply, request, 409, "PostedImmutable");
        if (msg === "CANCELLED_IMMUTABLE") return sendApiError(reply, request, 409, "CancelledImmutable");
        if (msg === "EMPTY_LINES") return sendApiError(reply, request, 400, "EmptyLines");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_SUPPLIER") return sendApiError(reply, request, 400, "BadSupplier");
        if (msg === "BAD_PRICE_TYPE") return sendApiError(reply, request, 400, "BadPriceType");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/goods-receipts",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(writeRoles, "receipt_add")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const out = await createGoodsReceipt(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send({ data: out });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "EMPTY_LINES") return sendApiError(reply, request, 400, "EmptyLines");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_SUPPLIER") return sendApiError(reply, request, 400, "BadSupplier");
        if (msg === "BAD_PRICE_TYPE") return sendApiError(reply, request, 400, "BadPriceType");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/goods-receipts/:id",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(writeRoles, ["receipt_change"])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const dqParsed = deleteQuerySchema.safeParse((request.query as Record<string, unknown>) ?? {});
      if (!dqParsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(dqParsed.error)
        );
      }
      const dq = dqParsed.data;
      try {
        await deleteGoodsReceiptDraft(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request),
          dq.delete_reason_ref?.trim() || null
        );
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_DRAFT") return sendApiError(reply, request, 409, "NotDraft");
        if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/goods-receipts/:id/restore",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikAnyEntitlement(writeRoles, ["receipt_change"])] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        await restoreGoodsReceiptDraft(request.tenant!.id, id, actorUserIdOrNull(request));
        return reply.status(204).send();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
        if (msg === "NOT_DRAFT") return sendApiError(reply, request, 409, "NotDraft");
        throw e;
      }
    }
  );
}
