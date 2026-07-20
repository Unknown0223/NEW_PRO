import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { readTabelAudit } from "./tabel-audit";
import { prisma } from "../../config/database";
import {
  WD_ROLES,
  addException,
  getWorkdaysState,
  removeException,
  removeOverride,
  saveSchedules,
  upsertOverride,
  type WdRole
} from "./workdays.service";

const readRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const scheduleSchema = z.array(z.boolean()).length(7);
const roleEnum = z.enum([...(WD_ROLES as readonly string[])] as [string, ...string[]]);
const roleOrAll = z.union([roleEnum, z.literal("ALL")]);

const schedulesBody = z.object({
  schedules: z.record(z.string(), scheduleSchema)
});
const exceptionBody = z.object({
  role: roleOrAll,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["holiday", "forced", "event", "training"]),
  comment: z.string().max(500).optional().default("")
});
const overrideBody = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  employeeCode: z.string().optional().default(""),
  position: z.string().optional().default(""),
  schedule: scheduleSchema,
  comment: z.string().max(500).optional().default("")
});

function actorLabel(request: FastifyRequest): string {
  const u = request.user as { role?: string; login?: string } | undefined;
  const role = u?.role?.trim();
  const login = u?.login?.trim();
  if (role && login) return `${role} (${login})`;
  return role || login || "система";
}

export async function registerTabelRoutes(app: FastifyInstance) {
  // ─────────── Рабочие дни ───────────
  app.get(
    "/api/:slug/workdays",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const data = await getWorkdaysState(request.tenant!.id);
      return reply.send({ data });
    }
  );

  app.put(
    "/api/:slug/workdays/schedules",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = schedulesBody.safeParse(request.body);
      if (!parsed.success)
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      const data = await saveSchedules(request.tenant!.id, actorLabel(request), parsed.data.schedules);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/workdays/exceptions",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = exceptionBody.safeParse(request.body);
      if (!parsed.success)
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      const data = await addException(request.tenant!.id, actorLabel(request), {
        role: parsed.data.role as WdRole | "ALL",
        date: parsed.data.date,
        type: parsed.data.type,
        comment: parsed.data.comment
      });
      return reply.send({ data });
    }
  );

  app.delete(
    "/api/:slug/workdays/exceptions/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { id } = request.params as { id: string };
      const data = await removeException(request.tenant!.id, id);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/workdays/overrides",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = overrideBody.safeParse(request.body);
      if (!parsed.success)
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      const data = await upsertOverride(request.tenant!.id, actorLabel(request), parsed.data);
      return reply.send({ data });
    }
  );

  app.delete(
    "/api/:slug/workdays/overrides/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const { id } = request.params as { id: string };
      const data = await removeOverride(request.tenant!.id, id);
      return reply.send({ data });
    }
  );

  // ─────────── Аудит табеля / графиков ───────────
  app.get(
    "/api/:slug/tabel-audit",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const tenant = await prisma.tenant.findUnique({
        where: { id: request.tenant!.id },
        select: { settings: true }
      });
      const records = tenant ? readTabelAudit(tenant.settings) : [];
      return reply.send({ data: { records } });
    }
  );
}
