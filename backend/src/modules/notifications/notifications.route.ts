import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { getAccessUser, jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { prisma } from "../../config/database";
import { createNotification, listNotifications, markAllRead, markNotificationRead } from "./notifications.service";

const adminWrite = ADMIN_AND_OPERATOR_LIKE_ROLES;

const notificationReadRoles = [
  ...ADMIN_AND_OPERATOR_LIKE_ROLES,
  "supervisor",
  "agent",
  "expeditor"
] as const;

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get("/api/:slug/notifications", {
    preHandler: [jwtAccessVerify, requireRoles(...notificationReadRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const viewer = getAccessUser(request);
    const userId = Number.parseInt(viewer.sub, 10);
    if (!Number.isFinite(userId) || userId < 1) return sendApiError(reply, request, 400, "BadUser");
    const qParsed = z
      .object({
        unread_only: z.enum(["true", "false"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional()
      })
      .safeParse(request.query);
    if (!qParsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid query", zodValidationExtras(qParsed.error));
    }
    const q = qParsed.data;
    const result = await listNotifications(tenantId, userId, {
      unread_only: q.unread_only === "true",
      limit: q.limit ?? 40
    });
    return reply.send(result);
  });

  app.patch("/api/:slug/notifications/:id/read", {
    preHandler: [jwtAccessVerify, requireRoles(...notificationReadRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const viewer = getAccessUser(request);
    const userId = Number.parseInt(viewer.sub, 10);
    if (!Number.isFinite(userId) || userId < 1) return sendApiError(reply, request, 400, "BadUser");
    const idParsed = z.coerce.number().int().positive().safeParse((request.params as { id: string }).id);
    if (!idParsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid id", zodValidationExtras(idParsed.error));
    }
    const id = idParsed.data;
    const row = await markNotificationRead(tenantId, userId, id);
    if (!row) return sendApiError(reply, request, 404, "NotFound");
    return reply.send(row);
  });

  app.post("/api/:slug/notifications/read-all", {
    preHandler: [jwtAccessVerify, requireRoles(...notificationReadRoles)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const viewer = getAccessUser(request);
    const userId = Number.parseInt(viewer.sub, 10);
    if (!Number.isFinite(userId) || userId < 1) return sendApiError(reply, request, 400, "BadUser");
    return reply.send(await markAllRead(tenantId, userId));
  });

  app.post("/api/:slug/notifications", {
    preHandler: [jwtAccessVerify, requireRoles(...adminWrite)]
  }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const tenantId = request.tenant!.id;
    const bodyParsed = z
      .object({
        user_id: z.number().int().positive(),
        title: z.string().min(1).max(500),
        body: z.string().max(4000).nullable().optional(),
        link_href: z.string().max(512).nullable().optional()
      })
      .safeParse(request.body);
    if (!bodyParsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(bodyParsed.error));
    }
    const body = bodyParsed.data;
    const target = await prisma.user.findFirst({
      where: { id: body.user_id, tenant_id: tenantId },
      select: { id: true }
    });
    if (!target) return sendApiError(reply, request, 400, "UserNotFound");
    const u = await createNotification({
      tenant_id: tenantId,
      user_id: body.user_id,
      title: body.title,
      body: body.body,
      link_href: body.link_href
    });
    return reply.status(201).send({ data: { id: u.id } });
  });
}
