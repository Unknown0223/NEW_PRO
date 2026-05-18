import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { parseSelectedMastersFromQuery, resolveConstraintScope } from "../linkage/linkage.service";
import {
  createSalesReturn,
  listSalesReturns,
  listSalesReturnsForOrder,
  getSalesReturnById
} from "./sales-returns.service";
import {
  getClientReturnsData,
  createPeriodReturn,
  createPeriodReturnBatch,
  createFullReturnFromOrder,
  MAX_RETURN_ITEMS
} from "./returns-enhanced.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const priceTypeOptional = z.string().trim().min(1).max(128).optional().nullable();

const createBody = z.object({
  warehouse_id: z.number().int().positive(),
  client_id: z.number().int().positive().nullable().optional(),
  order_id: z.number().int().positive().nullable().optional(),
  price_type: priceTypeOptional,
  refund_amount: z.number().positive().nullable().optional(),
  note: z.string().max(2000).optional().nullable(),
  refusal_reason_ref: z.string().trim().max(128).optional().nullable(),
  lines: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        qty: z.number().positive()
      })
    )
    .min(1)
});

const periodReturnLine = z.object({
  product_id: z.number().int().positive(),
  qty: z.number().positive().optional(),
  paid_qty: z.number().min(0).optional(),
  bonus_qty: z.number().min(0).optional(),
  bonus_cash: z.number().min(0).optional()
});

const periodReturnBody = z.object({
  client_id: z.number().int().positive(),
  order_id: z.number().int().positive().optional(),
  warehouse_id: z.number().int().positive().optional(),
  price_type: priceTypeOptional,
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  note: z.string().max(2000).optional().nullable(),
  refusal_reason_ref: z.string().trim().max(128).optional().nullable(),
  lines: z
    .array(periodReturnLine)
    .min(1)
    .refine(
      (lines) =>
        lines.reduce((a, l) => {
          const q = l.qty ?? 0;
          if (q > 0) return a + q;
          return a + (l.paid_qty ?? 0) + (l.bonus_qty ?? 0);
        }, 0) <= MAX_RETURN_ITEMS,
      { message: `Max ${MAX_RETURN_ITEMS} ta mahsulot qaytarish mumkin` }
    )
});

const periodReturnBatchLine = z.object({
  order_id: z.number().int().positive(),
  product_id: z.number().int().positive(),
  qty: z.number().positive().optional(),
  paid_qty: z.number().min(0).optional(),
  bonus_qty: z.number().min(0).optional(),
  bonus_cash: z.number().min(0).optional()
});

const periodReturnBatchBody = z.object({
  client_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive().optional(),
  price_type: priceTypeOptional,
  note: z.string().max(2000).optional().nullable(),
  refusal_reason_ref: z.string().trim().max(128).optional().nullable(),
  lines: z
    .array(periodReturnBatchLine)
    .min(1)
    .refine(
      (lines) =>
        lines.reduce((a, l) => {
          const q = l.qty ?? 0;
          if (q > 0) return a + q;
          return a + (l.paid_qty ?? 0) + (l.bonus_qty ?? 0);
        }, 0) <= MAX_RETURN_ITEMS,
      { message: `Max ${MAX_RETURN_ITEMS} ta mahsulot qaytarish mumkin` }
    )
});

const fullReturnBody = z.object({
  order_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive().optional(),
  price_type: priceTypeOptional,
  refund_amount: z.number().positive().optional(),
  note: z.string().max(2000).optional().nullable(),
  refusal_reason_ref: z.string().trim().max(128).optional().nullable()
});

function sendReturnNotInterchangeable(reply: FastifyReply, request: FastifyRequest, e: unknown) {
  const pid = (e as Error & { product_id?: number }).product_id;
  return sendApiError(
    reply,
    request,
    400,
    "ReturnNotInterchangeable",
    "Mahsulot faol interchangeable guruhda emas yoki tanlangan narx turi guruh bilan mos emas. Katalogda guruhni tekshiring.",
    pid != null ? { product_id: pid } : undefined
  );
}

export async function registerSalesReturnWriteRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/returns/period",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = periodReturnBody.safeParse(request.body);
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
        const data = await createPeriodReturn(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(data);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (code === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (code === "EMPTY_LINES") return sendApiError(reply, request, 400, "EmptyLines");
        if (code === "TOO_MANY_ITEMS")
          return sendApiError(reply, request, 400, "TooManyItems", undefined, { max: MAX_RETURN_ITEMS });
        if (code === "RETURN_QTY_EXCEEDS_ORDERED")
          return sendApiError(reply, request, 400, "QtyExceedsOrdered");
        if (code === "NOTHING_TO_RETURN")
          return sendApiError(reply, request, 400, "NothingToReturn");
        if (code === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (code === "ORDER_NOT_DELIVERED")
          return sendApiError(
            reply,
            request,
            400,
            "OrderNotDelivered",
            "Возврат с полки доступен только для заказов со статусом «Доставлен»."
          );
        if (code === "NO_WAREHOUSE") return sendApiError(reply, request, 400, "NoWarehouse");
        if (code === "BONUS_CASH_EXCEEDS")
          return sendApiError(reply, request, 400, "BonusCashExceeds");
        if (code === "MIXED_LINE_MODES" || code === "MIXED_LINE_FIELDS")
          return sendApiError(reply, request, 400, "BadLineMode");
        if (code === "EMPTY_LINE") return sendApiError(reply, request, 400, "EmptyLine");
        if (code === "RETURN_NOT_INTERCHANGEABLE") return sendReturnNotInterchangeable(reply, request, e);
        throw e;
      }
    }
  );

  // ─── Create period return — bir nechta zakaz (polki po zakaz) ───────────
  app.post(
    "/api/:slug/returns/period-batch",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = periodReturnBatchBody.safeParse(request.body);
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
        const data = await createPeriodReturnBatch(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send(data);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (code === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (code === "EMPTY_LINES") return sendApiError(reply, request, 400, "EmptyLines");
        if (code === "TOO_MANY_ITEMS")
          return sendApiError(reply, request, 400, "TooManyItems", undefined, { max: MAX_RETURN_ITEMS });
        if (code === "RETURN_QTY_EXCEEDS_ORDERED")
          return sendApiError(reply, request, 400, "QtyExceedsOrdered");
        if (code === "NOTHING_TO_RETURN")
          return sendApiError(reply, request, 400, "NothingToReturn");
        if (code === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (code === "ORDER_NOT_DELIVERED")
          return sendApiError(
            reply,
            request,
            400,
            "OrderNotDelivered",
            "Возврат с полки доступен только для заказов со статусом «Доставлен»."
          );
        if (code === "NO_WAREHOUSE") return sendApiError(reply, request, 400, "NoWarehouse");
        if (code === "BONUS_CASH_EXCEEDS")
          return sendApiError(reply, request, 400, "BonusCashExceeds");
        if (code === "MIXED_LINE_MODES" || code === "MIXED_LINE_FIELDS")
          return sendApiError(reply, request, 400, "BadLineMode");
        if (code === "EMPTY_LINE") return sendApiError(reply, request, 400, "EmptyLine");
        if (code === "RETURN_NOT_INTERCHANGEABLE") return sendReturnNotInterchangeable(reply, request, e);
        throw e;
      }
    }
  );

  // ─── Full order return ─────────────────────────────────────────────────
  app.post(
    "/api/:slug/returns/full-order",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = fullReturnBody.safeParse(request.body);
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
        const data = await createFullReturnFromOrder(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(data);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (code === "ORDER_NOT_RETURNABLE")
          return sendApiError(reply, request, 400, "OrderNotReturnable");
        if (code === "ORDER_ALREADY_FULLY_RETURNED")
          return sendApiError(reply, request, 409, "OrderAlreadyFullyReturned");
        if (code === "NO_WAREHOUSE") return sendApiError(reply, request, 400, "NoWarehouse");
        if (code === "RETURN_NOT_INTERCHANGEABLE") return sendReturnNotInterchangeable(reply, request, e);
        throw e;
      }
    }
  );

  // ─── Basic create return (backward compat) ─────────────────────────────
  app.post(
    "/api/:slug/returns",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createBody.safeParse(request.body);
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
        const row = await createSalesReturn(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send(row);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (msg === "BAD_ORDER_CLIENT") return sendApiError(reply, request, 400, "BadOrderClient");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        if (msg === "EMPTY_LINES") return sendApiError(reply, request, 400, "EmptyLines");
        if (msg === "REFUND_NEEDS_CLIENT") return sendApiError(reply, request, 400, "RefundNeedsClient");
        if (msg === "RETURN_NOT_INTERCHANGEABLE") return sendReturnNotInterchangeable(reply, request, e);
        throw e;
      }
    }
  );
}
