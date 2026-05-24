import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { listTimesheetFilters, listTimesheetMatrix, patchAttendanceCell } from "./timesheet.service";

const readRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const patchBody = z.object({
  status: z.enum(["worked", "absent", "vacation", "sick", "holiday"]),
  source: z.enum(["manual", "gps", "mobile_login", "auto"]).optional()
});

export async function registerTimesheetRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/timesheet/filters",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await listTimesheetFilters(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.get(
    "/api/:slug/timesheet",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const q = request.query as Record<string, string | undefined>;
      const month = (q.month ?? "").trim();
      if (!month) return sendApiError(reply, request, 400, "BadMonth");
      const user_id = q.user_id ? Number.parseInt(q.user_id, 10) : undefined;
      if (q.user_id && Number.isNaN(user_id)) return sendApiError(reply, request, 400, "BadUserId");
      try {
        const data = await listTimesheetMatrix(request.tenant!.id, {
          month,
          role: q.role?.trim() || undefined,
          user_id
        });
        return reply.send({ data });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_MONTH") return sendApiError(reply, request, 400, "BadMonth");
        throw e;
      }
    }
  );

  app.patch(
    "/api/:slug/timesheet/:userId/:date",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const p = request.params as { userId: string; date: string };
      const userId = Number.parseInt(p.userId, 10);
      if (Number.isNaN(userId)) return sendApiError(reply, request, 400, "BadUserId");
      const parsed = patchBody.safeParse(request.body);
      if (!parsed.success)
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      try {
        const data = await patchAttendanceCell(request.tenant!.id, actorUserIdOrNull(request), {
          userId,
          date: p.date,
          status: parsed.data.status,
          source: parsed.data.source
        });
        return reply.send(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "BAD_DATE") return sendApiError(reply, request, 400, "BadDate");
        if (msg === "FUTURE_DATE_DENIED") return sendApiError(reply, request, 400, "FutureDateDenied");
        if (msg === "PAYROLL_PERIOD_LOCKED") return sendApiError(reply, request, 409, "PayrollPeriodLocked");
        if (msg === "USER_NOT_FOUND") return sendApiError(reply, request, 404, "UserNotFound");
        throw e;
      }
    }
  );
}
