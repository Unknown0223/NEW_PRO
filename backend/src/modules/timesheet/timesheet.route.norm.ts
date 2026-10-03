import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/database";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { readTabelAudit } from "../tabel/tabel-audit";
import { getAgentNormSettings, saveAgentNormSettings } from "./timesheet.norm-settings";

const readRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const writeRoles = ADMIN_AND_OPERATOR_LIKE_ROLES;

const normBody = z
  .object({
    enabled: z.boolean(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    open_amount: z.number().positive().max(1_000_000_000_000),
    closed_amount: z.number().positive().max(1_000_000_000_000),
    comment: z.string().max(500).optional()
  })
  .strict();

/** Tarixda ko‘rinadigan muallif: «FIO (login)». */
export async function timesheetActorLabel(request: FastifyRequest): Promise<string> {
  const u = request.user as { role?: string; login?: string } | undefined;
  const uid = actorUserIdOrNull(request);
  if (uid != null) {
    const row = await prisma.user.findUnique({ where: { id: uid }, select: { name: true, login: true } });
    const name = row?.name?.trim();
    const login = row?.login?.trim() || u?.login?.trim();
    if (name && login) return `${name} (${login})`;
    if (name || login) return (name || login)!;
  }
  const role = u?.role?.trim();
  const login = u?.login?.trim();
  if (role && login) return `${role} (${login})`;
  return role || login || "система";
}

export async function registerTimesheetNormRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/timesheet/norm-settings",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      return reply.send({ data: await getAgentNormSettings(request.tenant!.id) });
    }
  );

  app.put(
    "/api/:slug/timesheet/norm-settings",
    { preHandler: [jwtAccessVerify, requireRoles(...writeRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = normBody.safeParse(request.body);
      if (!parsed.success)
        return sendApiError(reply, request, 400, "ValidationError", undefined, zodValidationExtras(parsed.error));
      const { comment, ...cfg } = parsed.data;
      const data = await saveAgentNormSettings(request.tenant!.id, cfg, {
        userId: actorUserIdOrNull(request),
        label: await timesheetActorLabel(request),
        comment
      });
      return reply.send({ data });
    }
  );

  /** Табель tarixi: qo‘lda o‘zgartirishlar va norma sozlamalari (yangilari tepada). */
  app.get(
    "/api/:slug/timesheet/history",
    { preHandler: [jwtAccessVerify, requireRoles(...readRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const t = await prisma.tenant.findUnique({ where: { id: request.tenant!.id }, select: { settings: true } });
      const records = t ? readTabelAudit(t.settings).filter((r) => r.module === "timesheet") : [];
      return reply.send({ data: { records } });
    }
  );
}
