import type { FastifyInstance } from "fastify";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableByDate } from "../../lib/document-edit-lock.request";
import { getErrorCode } from "../../lib/app-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { previewMobileOrderBonus } from "./mobile-order-bonus-preview.service";
import {
  mobileCreateOrderBodySchema,
  mobileEnqueueBodySchema,
  mobileOrderBonusPreviewBodySchema,
  mobileOrderStockQuerySchema,
  mobileOrdersHistoryQuerySchema,
  mobileWarehouseStockQuerySchema
} from "./mobile.route.agent.schemas";
import {
  createMobileOrder,
  enqueueOrder,
  getMobileAgentOrderDetail,
  getMobileOrderStock,
  getMobileWarehouseStockView,
  getPendingCount,
  listMobileAgentOrdersHistory,
  syncOrders
} from "./mobile.service";
import {
  mobileAgentConfigPreHandler,
  mobileOfflineOrderPreHandler,
  parseDateLike
} from "./mobile.route.shared";

export async function registerMobileAgentOrderRoutes(app: FastifyInstance) {

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/orders/stock — ombor qoldig‘i (tanlangan mahsulotlar)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/orders/stock",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileOrderStockQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const productIds = parsed.data.product_ids
        .split(/[,;\s]+/)
        .map((s) => Number.parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const data = await getMobileOrderStock(
        request.tenant!.id,
        parsed.data.warehouse_id,
        productIds
      );
      return reply.send({ data });
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/warehouse-stock — ombor qoldig‘i (agent, bitta javob)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/warehouse-stock",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileWarehouseStockQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      const role = getAccessUser(request).role;
      if (role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const data = await getMobileWarehouseStockView(
        request.tenant!.id,
        userId,
        parsed.data.warehouse_id
      );
      return reply.send(data);
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/orders/bonus-preview — bonus/skidka oldindan ko‘rish
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/orders/bonus-preview",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileOrderBonusPreviewBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const viewer = getAccessUser(request);
      const userId = Number.parseInt(viewer.sub, 10);
      if (viewer.role !== "agent" || !Number.isFinite(userId) || userId < 1) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      try {
        const data = await previewMobileOrderBonus(request.tenant!.id, userId, parsed.data);
        return reply.send(data);
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_AGENT") return sendApiError(reply, request, 400, "BadAgent");
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        if (msg === "EMPTY_ITEMS") return sendApiError(reply, request, 400, "EmptyItems");
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/orders/create — zakaz (bonus/skidka serverda)
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/orders/create",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileCreateOrderBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const viewer = getAccessUser(request);
      const userId = Number.parseInt(viewer.sub, 10);
      if (viewer.role !== "agent" || !Number.isFinite(userId) || userId < 1) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      try {
        const row = await createMobileOrder(request.tenant!.id, userId, viewer.role, parsed.data);
        return reply.status(201).send(row);
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "PHOTO_REPORT_REQUIRED") {
          return sendApiError(reply, request, 400, "PhotoReportRequired");
        }
        if (msg === "STOCK_SNAPSHOT_REQUIRED") {
          return sendApiError(reply, request, 400, "StockSnapshotRequired");
        }
        if (msg === "SHIPMENT_DATE_REQUIRED" || msg === "SHIPMENT_DATE_INVALID") {
          return sendApiError(reply, request, 400, "ShipmentDateRequired");
        }
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        if (msg === "BAD_AGENT") return sendApiError(reply, request, 400, "BadAgent");
        if (msg === "AGENT_NOT_ON_SLOT") {
          return sendApiError(
            reply,
            request,
            403,
            "AgentNotOnSlot",
            "Агент не на рабочем месте — новый заказ запрещён"
          );
        }
        if (msg === "BAD_PRODUCT") return sendApiError(reply, request, 400, "BadProduct");
        if (msg === "BAD_QTY") return sendApiError(reply, request, 400, "BadQty");
        if (msg === "EMPTY_ITEMS") return sendApiError(reply, request, 400, "EmptyItems");
        if (msg === "BAD_BONUS_GIFT_OVERRIDE") {
          return sendApiError(reply, request, 400, "BadBonusGiftOverride");
        }
        if (msg === "NO_PRICE") {
          const ex = e as Error & { product_id?: number; price_type?: string };
          return sendApiError(reply, request, 400, "NoPrice", undefined, {
            product_id: ex.product_id,
            price_type: ex.price_type ?? "retail"
          });
        }
        if (msg === "INSUFFICIENT_STOCK") {
          const ex = e as Error & { product_id?: number; available?: string; requested?: string };
          return sendApiError(reply, request, 400, "InsufficientStock", undefined, {
            product_id: ex.product_id,
            available: ex.available,
            requested: ex.requested
          });
        }
        if (msg === "ORDER_RESTRICTED") {
          const ex = e as Error & { rule_id?: number; rule_name?: string };
          return sendApiError(reply, request, 403, "OrderRestricted", ex.rule_name);
        }
        if (msg === "CREDIT_LIMIT_EXCEEDED") {
          const ex = e as Error & { credit_limit?: string; outstanding?: string; order_total?: string };
          return sendApiError(reply, request, 400, "CreditLimitExceeded", undefined, {
            credit_limit: ex.credit_limit,
            outstanding: ex.outstanding,
            order_total: ex.order_total
          });
        }
        if (msg === "ORDER_BLOCKED_BY_DEBT") {
          return sendApiError(
            reply,
            request,
            400,
            "OrderBlockedByDebt",
            "Заказ запрещён: у клиента есть долг"
          );
        }
        if (msg === "CONSIGNMENT_CLIENT_DISABLED") {
          return sendApiError(
            reply,
            request,
            400,
            "ConsignmentClientDisabled",
            "Консигнационные заказы для этого клиента запрещены"
          );
        }
        if (msg === "CONSIGNMENT_BLOCKED_BY_DEBT") {
          return sendApiError(
            reply,
            request,
            400,
            "ConsignmentBlockedByDebt",
            "Консигнация запрещена: есть долг по консигнации"
          );
        }
        if (msg === "CONSIGNMENT_REQUIRES_AGENT") {
          return sendApiError(reply, request, 400, "ConsignmentRequiresAgent");
        }
        if (msg === "CONSIGNMENT_AGENT_DISABLED") {
          return sendApiError(reply, request, 400, "ConsignmentAgentDisabled");
        }
        if (msg === "CONSIGNMENT_LIMIT_EXCEEDED") {
          const ex = e as Error & {
            consignment_limit?: string;
            outstanding?: string;
            order_total?: string;
          };
          return sendApiError(reply, request, 400, "ConsignmentLimitExceeded", undefined, {
            consignment_limit: ex.consignment_limit,
            outstanding: ex.outstanding,
            order_total: ex.order_total
          });
        }
        if (msg === "BAD_CONSIGNMENT_DUE_DATE") {
          return sendApiError(reply, request, 400, "BadConsignmentDueDate");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/orders/enqueue  — queue an offline order
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/orders/enqueue",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileEnqueueBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const offlineCreatedAtParsed = parseDateLike(parsed.data.offline_created_at);
      if (offlineCreatedAtParsed === undefined) {
        return sendApiError(reply, request, 400, "ValidationError", "Invalid date format", {
          field: "offline_created_at"
        });
      }
      const userId = Number(getAccessUser(request).sub);
      // Offline buyurtma vaqti qurilmadan keladi — kelajakdagi sana har doim
      // qurilma soati aldangani belgisi (offline zakaz kelajakda yaratilmaydi).
      // Server soatidan kichik «skew» bilan oldinga ketganini «hozir»ga
      // qisqartiramiz (forward-dating'ni yopamiz; legitim backdating qoladi).
      const serverNow = new Date();
      const CLOCK_SKEW_MS = 2 * 60 * 1000;
      let offlineCreated = offlineCreatedAtParsed ?? serverNow;
      if (offlineCreated.getTime() > serverNow.getTime() + CLOCK_SKEW_MS) {
        offlineCreated = serverNow;
      }

      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      try {
        await assertDocWritableByDate(request, "orders", offlineCreated);
        const result = await enqueueOrder(
          request.tenant!.id,
          userId,
          parsed.data.client_local_id ?? parsed.data.client_id!,
          parsed.data.warehouse_id,
          parsed.data.items,
          offlineCreated,
          { price_type: parsed.data.price_type, comment: parsed.data.comment }
        );
        return reply.status(201).send(result);
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = getErrorCode(e) ?? "";
        if (msg === "PHOTO_REPORT_REQUIRED") {
          return sendApiError(reply, request, 400, "PhotoReportRequired");
        }
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_WAREHOUSE") return sendApiError(reply, request, 400, "BadWarehouse");
        throw e;
      }
    },
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/orders/history — agent bugungi zakazlar (mahsulotlar + bonus)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/orders/history",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileOrdersHistoryQuerySchema.safeParse(request.query ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      const userId = Number(getAccessUser(request).sub);
      const result = await listMobileAgentOrdersHistory(request.tenant!.id, userId, {
        date: parsed.data.date
      });
      return reply.send(result);
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/orders/:id/detail — bitta zakaz (mahsulotlar + bonus)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/orders/:id/detail",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const idParsed = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!idParsed.success) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const userId = Number(getAccessUser(request).sub);
      try {
        const data = await getMobileAgentOrderDetail(
          request.tenant!.id,
          userId,
          idParsed.data.id
        );
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  // -----------------------------------------------------------------------
  // GET /api/:slug/mobile/orders/pending  — count pending offline orders
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/orders/pending",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      const result = await getPendingCount(request.tenant!.id, userId);
      return reply.send(result);
    },
  );

  // -----------------------------------------------------------------------
  // POST /api/:slug/mobile/orders/sync-flush — push pending offline orders
  // -----------------------------------------------------------------------
  app.post(
    "/api/:slug/mobile/orders/sync-flush",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role !== "agent") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number(getAccessUser(request).sub);
      const result = await syncOrders(request.tenant!.id, userId);
      return reply.send(result);
    }
  );
}
