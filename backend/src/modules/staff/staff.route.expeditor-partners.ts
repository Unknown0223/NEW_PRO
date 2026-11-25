import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import {
  DIRECTORY_READ_ROLES,
  getAccessUser,
  jwtAccessVerify,
  requireRoles
} from "../auth/auth.prehandlers";
import {
  SHARE_PARTNER_EDITOR_ROLES,
  addExpeditorSharePartner,
  listExpeditorSharePartners,
  removeExpeditorSharePartner
} from "../mobile/share/share-partners.service";

const editorRoles = [...SHARE_PARTNER_EDITOR_ROLES] as string[];

export async function registerStaffExpeditorPartnerRoutes(app: FastifyInstance) {
  app.get(
    "/api/:slug/staff/expeditors/:userId/share-partners",
    { preHandler: [jwtAccessVerify, requireRoles(...DIRECTORY_READ_ROLES)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (viewer.role === "expeditor") {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const userId = Number((request.params as { userId?: string }).userId);
      if (!Number.isFinite(userId) || userId <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const data = await listExpeditorSharePartners(request.tenant!.id, userId);
      return reply.send({ data });
    }
  );

  app.post(
    "/api/:slug/staff/expeditors/:userId/share-partners",
    { preHandler: [jwtAccessVerify, requireRoles(...editorRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number((request.params as { userId?: string }).userId);
      const body = z
        .object({ partner_user_id: z.number().int().positive() })
        .safeParse(request.body ?? {});
      if (!Number.isFinite(userId) || userId <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      if (!body.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(body.error)
        );
      }
      try {
        const row = await addExpeditorSharePartner({
          tenantId: request.tenant!.id,
          ownerExpeditorUserId: userId,
          partnerExpeditorUserId: body.data.partner_user_id
        });
        return reply.code(201).send({ data: row });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        if (e instanceof Error && e.message === "SAME_USER") {
          return sendApiError(reply, request, 400, "SameUser");
        }
        throw e;
      }
    }
  );

  app.delete(
    "/api/:slug/staff/expeditors/:userId/share-partners/:id",
    { preHandler: [jwtAccessVerify, requireRoles(...editorRoles)] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const userId = Number((request.params as { userId?: string }).userId);
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(userId) || userId <= 0 || !Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const data = await removeExpeditorSharePartner({
          tenantId: request.tenant!.id,
          ownerExpeditorUserId: userId,
          partnerRowId: id
        });
        return reply.send({ data });
      } catch (e) {
        if (e instanceof Error && e.message === "NOT_FOUND") {
          return sendApiError(reply, request, 404, "NotFound");
        }
        throw e;
      }
    }
  );
}
