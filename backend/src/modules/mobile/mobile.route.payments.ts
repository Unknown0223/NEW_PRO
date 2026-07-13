import type { FastifyInstance } from "fastify";
import {
  createOrderCashInBodySchema,
  orderCashInContextQuerySchema
} from "../../contracts/payments.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  createOrderCashInBatch,
  getOrderCashInContext
} from "../payments/payment.order-cash-in";
import { mobileOfflineOrderPreHandler } from "./mobile.route.shared";

export async function registerMobilePaymentRoutes(app: FastifyInstance) {
  // -----------------------------------------------------------------------
  // Van selling — order cash-in (agent)
  // -----------------------------------------------------------------------
  app.get(
    "/api/:slug/mobile/payments/order-cash-in/context",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = orderCashInContextQuerySchema.safeParse(request.query);
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
      const orderIdsRaw = parsed.data.order_ids?.trim();
      const order_ids = orderIdsRaw
        ? orderIdsRaw
            .split(/[,]+/)
            .map((s) => Number.parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n) && n > 0)
        : undefined;
      try {
        const data = await getOrderCashInContext(request.tenant!.id, {
          client_id: parsed.data.client_id,
          order_ids
        });
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/payments/order-cash-in",
    { preHandler: [...mobileOfflineOrderPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = createOrderCashInBodySchema.safeParse(request.body);
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
        const data = await createOrderCashInBatch(
          request.tenant!.id,
          parsed.data,
          actorUserIdOrNull(request)
        );
        return reply.status(201).send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_CLIENT") return sendApiError(reply, request, 400, "BadClient");
        if (msg === "BAD_ORDER") return sendApiError(reply, request, 400, "BadOrder");
        if (msg === "BAD_AMOUNT") return sendApiError(reply, request, 400, "BadAmount");
        if (msg === "BAD_PAYMENT_TYPE") return sendApiError(reply, request, 400, "BadPaymentType");
        if (msg === "NO_LINES") return sendApiError(reply, request, 400, "NoLines");
        if (msg === "BAD_CASH_DESK") return sendApiError(reply, request, 400, "BadCashDesk");
        throw e;
      }
    }
  );
}
