import type { FastifyInstance } from "fastify";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { bindQrByCode, unbindQrByCode } from "../client-qr/client-qr.write";
import { recordMobileStockSnapshot } from "./mobile-order-policy";
import { mobileAgentConfigPreHandler, mobileQrBodySchema } from "./mobile.route.shared";

export async function registerMobileClientQrRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/mobile/client-qr/bind",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileQrBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      if (parsed.data.client_id == null) {
        return sendApiError(reply, request, 400, "ValidationError");
      }
      try {
        await bindQrByCode({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          qrCode: parsed.data.qr_code,
          clientId: parsed.data.client_id
        });
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "CLIENT_ALREADY_HAS_QR") {
          return sendApiError(reply, request, 409, "ClientAlreadyHasQr");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/client-qr/unbind",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = mobileQrBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      }
      try {
        await unbindQrByCode({
          tenantId: request.tenant!.id,
          actorUserId: actorUserIdOrNull(request),
          qrCode: parsed.data.qr_code
        });
        return reply.send({ ok: true });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/stock-snapshot",
    { preHandler: [...mobileAgentConfigPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number(getAccessUser(request).sub);
      if (!Number.isFinite(userId) || userId < 1) {
        return sendApiError(reply, request, 401, "Unauthorized");
      }
      await recordMobileStockSnapshot(request.tenant!.id, userId);
      return reply.send({ ok: true });
    }
  );
}
