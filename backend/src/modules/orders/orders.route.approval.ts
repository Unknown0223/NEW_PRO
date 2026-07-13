import type { FastifyInstance } from "fastify";
import { positiveIntPathIdParamsSchema } from "../../contracts/route-params.schemas";
import { getErrorCode } from "../../lib/app-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { sendApiError } from "../../lib/api-error";
import { writeApiRateLimitRouteOpts } from "../../lib/rate-limit-config";
import { ORDER_APPROVAL_ROUTE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import {
  advanceOrderApproval,
  getOrderApprovalView,
  rejectOrderApproval
} from "./order-approval.service";
import { getOrderDetail, updateOrderStatus } from "./orders.service";

const catalogRoles = ORDER_APPROVAL_ROUTE_ROLES;

export async function registerOrderApprovalRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/orders/:id/approval",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsedParams = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) return sendApiError(reply, request, 400, "InvalidId");

      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;

      const view = await getOrderApprovalView(
        request.tenant!.id,
        parsedParams.data.id,
        actorUserId,
        actor.role
      );
      if (!view) return sendApiError(reply, request, 404, "NotFound");
      return reply.send({ data: view });
    }
  );

  app.post(
    "/api/:slug/orders/:id/approval/advance",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsedParams = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) return sendApiError(reply, request, 400, "InvalidId");

      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
      if (actorUserId == null) return sendApiError(reply, request, 401, "Unauthorized");

      try {
        const result = await advanceOrderApproval(
          request.tenant!.id,
          parsedParams.data.id,
          actorUserId,
          actor.role
        );
        if (result.done) {
          await updateOrderStatus(
            request.tenant!.id,
            parsedParams.data.id,
            "confirmed",
            actorUserId,
            actor.role
          );
          const row = await getOrderDetail(request.tenant!.id, parsedParams.data.id, actor.role);
          return reply.send({ data: { approval: result.view, order: row } });
        }
        return reply.send({ data: { approval: result.view } });
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "APPROVAL_NOT_PENDING") return sendApiError(reply, request, 400, "ApprovalNotPending");
        if (msg === "FORBIDDEN_APPROVER") return sendApiError(reply, request, 403, "ForbiddenApprover");
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/orders/:id/approval/reject",
    { preHandler: [jwtAccessVerify, requireRoles(...catalogRoles)], ...writeApiRateLimitRouteOpts },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsedParams = positiveIntPathIdParamsSchema.safeParse(request.params);
      if (!parsedParams.success) return sendApiError(reply, request, 400, "InvalidId");

      const actor = getAccessUser(request);
      const actorSub = Number.parseInt(actor.sub, 10);
      const actorUserId = Number.isFinite(actorSub) && actorSub > 0 ? actorSub : null;
      if (actorUserId == null) return sendApiError(reply, request, 401, "Unauthorized");

      try {
        const view = await rejectOrderApproval(
          request.tenant!.id,
          parsedParams.data.id,
          actorUserId,
          actor.role
        );
        return reply.send({ data: view });
      } catch (e) {
        const msg = getErrorCode(e) ?? "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "APPROVAL_NOT_PENDING") return sendApiError(reply, request, 400, "ApprovalNotPending");
        if (msg === "FORBIDDEN_APPROVER") return sendApiError(reply, request, 403, "ForbiddenApprover");
        throw e;
      }
    }
  );
}
