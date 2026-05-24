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
import { getClientReturnsData } from "./returns-enhanced.service";

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

export async function registerSalesReturnReadRoutes(app: FastifyInstance) {
  // ─── List returns ──────────────────────────────────────────────────────
  app.get(
    "/api/:slug/returns",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const page = Math.max(1, Number.parseInt(q.page ?? "1", 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(q.limit ?? "30", 10) || 30));
      const warehouse_id = q.warehouse_id ? Number.parseInt(q.warehouse_id, 10) : undefined;
      const client_id = q.client_id ? Number.parseInt(q.client_id, 10) : undefined;
      const status = q.status?.trim();
      const selected = parseSelectedMastersFromQuery(q);
      const scope = await resolveConstraintScope(request.tenant!.id, selected);
      const result = await listSalesReturns(request.tenant!.id, {
        page, limit,
        status: status && status.length > 0 ? status : undefined,
        warehouse_id: warehouse_id != null && warehouse_id > 0 ? warehouse_id : undefined,
        client_id: client_id != null && client_id > 0 ? client_id : undefined,
        warehouse_ids: scope.constrained ? scope.warehouse_ids : undefined,
        client_ids: scope.constrained ? scope.client_ids : undefined
      });
      return reply.send(result);
    }
  );

  app.get(
    "/api/:slug/returns/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const row = await getSalesReturnById(request.tenant!.id, id);
      if (!row) return sendApiError(reply, request, 404, "NotFound");
      return reply.send(row);
    }
  );

  // ─── Returns for a specific order ──────────────────────────────────────
  app.get(
    "/api/:slug/orders/:id/returns",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) return sendApiError(reply, request, 400, "InvalidId");
      const data = await listSalesReturnsForOrder(request.tenant!.id, id);
      return reply.send({ data });
    }
  );

  // ─── Client returns data (with date filter) ────────────────────────────
  app.get(
    "/api/:slug/returns/client-data",
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
      const orderIdsRaw = q.order_ids?.trim();
      let orderIds: number[] | undefined;
      if (orderIdsRaw) {
        const parsed = orderIdsRaw
          .split(/[, ]+/)
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0);
        const uniq = [...new Set(parsed)];
        if (uniq.length > 0) orderIds = uniq;
      }
      const orderRaw = q.order_id?.trim();
      let orderId: number | undefined;
      if (!orderIds?.length && orderRaw) {
        const n = Number.parseInt(orderRaw, 10);
        if (!Number.isNaN(n) && n > 0) orderId = n;
      }
      try {
        const data = await getClientReturnsData(
          request.tenant!.id,
          clientId,
          q.date_from,
          q.date_to,
          orderId,
          orderIds
        );
        return reply.send(data);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (code === "ORDER_NOT_DELIVERED")
          return sendApiError(
            reply,
            request,
            400,
            "OrderNotDelivered",
            "Возврат с полки доступен только для заказов со статусом «Доставлен»."
          );
        if (code === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        throw e;
      }
    }
  );
}
