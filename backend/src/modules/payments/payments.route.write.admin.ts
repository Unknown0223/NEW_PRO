import type { FastifyInstance } from "fastify";
import {
  createPaymentEditGrantBodySchema,
  deletePaymentQuerySchema,
  restorePaymentBodySchema
} from "../../contracts/payments.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import {
  isDocumentEditPeriodLockedError,
  sendDocumentEditPeriodLocked
} from "../../lib/document-edit-lock.http";
import { assertDocWritableById } from "../../lib/document-edit-lock.request";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { deletePayment, restorePayment } from "./payments.service";
import { createPaymentEditGrant } from "./payment-edit-grants.service";

const catalogRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

export function registerPaymentAdminWriteRoutes(app: FastifyInstance): void {
  app.delete(
    "/api/:slug/payments/:id",
    { preHandler: [jwtAccessVerify, requireRoles("admin")], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id)) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const q = deletePaymentQuerySchema.parse((request.query as Record<string, unknown>) ?? {});
      try {
        await assertDocWritableById(request, "payments", id);
        await deletePayment(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request),
          q.cancel_reason_ref?.trim() || null
        );
        return reply.status(204).send();
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "ALREADY_VOIDED") return sendApiError(reply, request, 409, "AlreadyVoided");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/:id/restore",
    { preHandler: [jwtAccessVerify, requireRoles("admin")], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const parsed = restorePaymentBodySchema.safeParse(request.body ?? {});
        if (!parsed.success) {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Invalid request body",
            zodValidationExtras(parsed.error)
          );
        }
        await assertDocWritableById(request, "payments", id);
        await restorePayment(
          request.tenant!.id,
          id,
          actorUserIdOrNull(request),
          parsed.data.comment
        );
        return reply.status(204).send();
      } catch (e) {
        if (isDocumentEditPeriodLockedError(e)) return sendDocumentEditPeriodLocked(reply, request);
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "NOT_VOIDED") return sendApiError(reply, request, 409, "NotVoided");
        if (msg === "RESTORE_COMMENT_REQUIRED") {
          return sendApiError(reply, request, 400, "ValidationError", "Restore comment is required");
        }
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/payments/:id/edit-grants",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenantId = request.tenant!.id;
      const id = Number.parseInt((request.params as { id: string }).id, 10);
      if (Number.isNaN(id) || id < 1) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const parsed = createPaymentEditGrantBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Invalid request body",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const payload = await createPaymentEditGrant(tenantId, id, actorUserIdOrNull(request), parsed.data);
        return reply.status(201).send(payload);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "BAD_ACCESS_USER") return sendApiError(reply, request, 400, "BadExpeditor");
        if (msg === "BAD_DURATION") return sendApiError(reply, request, 400, "ValidationError", "Bad duration");
        throw e;
      }
    }
  );
}
