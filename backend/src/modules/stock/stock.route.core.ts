import type { FastifyInstance } from "fastify";
import { adminRoles, catalogRoles } from "./stock.route.shared";

import { actorUserIdOrNull } from "../../lib/request-actor";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { requireRolesOrSkladchikEntitlement } from "../staff/skladchik-access.prehandler";
import { applyStockReceipt, listStockForTenant } from "./stock.service";
import { receiptBody } from "./stock.route.schemas";


export async function registerStockCoreRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/stock",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(catalogRoles, "stock_balance_list")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as { warehouse_id?: string; product_ids?: string };
      const raw = q.warehouse_id?.trim();
      const warehouseId =
        raw != null && raw !== "" && /^\d+$/.test(raw) ? Number.parseInt(raw, 10) : undefined;
      const productIds = (q.product_ids ?? "")
        .split(/[,;\s]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const data = await listStockForTenant(
        request.tenant!.id,
        warehouseId,
        productIds.length > 0 ? productIds : null
      );
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/stock/receipts",
    { preHandler: [jwtAccessVerify, requireRolesOrSkladchikEntitlement(adminRoles, "receipt_add")] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = receiptBody.safeParse(request.body);
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
        await applyStockReceipt(request.tenant!.id, parsed.data, actorUserIdOrNull(request));
        return reply.status(201).send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "EMPTY_ITEMS") return sendApiError(reply, request, 400, "EmptyItems");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        throw e;
      }
    }
  );
}
