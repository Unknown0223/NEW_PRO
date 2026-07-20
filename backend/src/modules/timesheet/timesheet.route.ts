import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES, TENANT_ADMIN_ROLE } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { listTimesheetFilters, listTimesheetMatrix, patchAttendanceCell, patchAttendanceCells } from "./timesheet.service";

const readRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const statusEnum = z.enum(["worked", "half_day", "absent", "vacation", "sick", "holiday", "trip"]);
const sourceEnum = z.enum(["manual", "gps", "mobile_login", "auto"]);

const patchBody = z.object({
  status: statusEnum,
  source: sourceEnum.optional(),
  comment: z.string().max(500).optional()
});

const batchBody = z.object({
  entries: z
    .array(
      z.object({
        userId: z.number().int().positive(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        status: statusEnum,
        source: sourceEnum.optional(),
        comment: z.string().max(500).optional()
      })
    )
    .min(1)
    .max(2000)
});

function mapPatchError(reply: Parameters<typeof sendApiError>[0], request: Parameters<typeof sendApiError>[1], e: unknown): boolean {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "BAD_DATE") return void sendApiError(reply, request, 400, "BadDate"), true;
  if (msg === "FUTURE_DATE_DENIED") return void sendApiError(reply, request, 400, "FutureDateDenied"), true;
  if (msg === "PAYROLL_PERIOD_LOCKED") return void sendApiError(reply, request, 409, "PayrollPeriodLocked"), true;
  if (msg === "USER_NOT_FOUND") return void sendApiError(reply, request, 404, "UserNotFound"), true;
  if (msg === "SLOT_LEFT_DAY_LOCKED") return void sendApiError(reply, request, 403, "SlotLeftDayLocked"), true;
  return false;
}

function actorLabel(request: { user?: unknown }): string {
  const u = request.user as { role?: string; login?: string } | undefined;
  const role = u?.role?.trim();
  const login = u?.login?.trim();
  if (role && login) return `${role} (${login})`;
  return role || login || "система";
}

function actorIsAdmin(request: { user?: unknown }): boolean {
  const role = (request.user as { role?: string } | undefined)?.role?.trim();
  return role === TENANT_ADMIN_ROLE;
}

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

  // Массовая правка табеля одним запросом (paint-режим, диапазон дней, «Сохранить»).
  app.patch(
    "/api/:slug/timesheet/batch",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = batchBody.safeParse(request.body);
      if (!parsed.success)
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      try {
        const data = await patchAttendanceCells(
          request.tenant!.id,
          actorUserIdOrNull(request),
          parsed.data.entries,
          actorLabel(request),
          { actorIsAdmin: actorIsAdmin(request) }
        );
        return reply.send(data);
      } catch (e) {
        if (mapPatchError(reply, request, e)) return;
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
        const data = await patchAttendanceCell(
          request.tenant!.id,
          actorUserIdOrNull(request),
          {
            userId,
            date: p.date,
            status: parsed.data.status,
            source: parsed.data.source,
            comment: parsed.data.comment,
            changedBy: actorLabel(request)
          },
          { actorIsAdmin: actorIsAdmin(request) }
        );
        return reply.send(data);
      } catch (e) {
        if (mapPatchError(reply, request, e)) return;
        throw e;
      }
    }
  );
}
