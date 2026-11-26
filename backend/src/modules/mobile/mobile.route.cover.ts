import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { getAccessUser } from "../auth/auth.prehandlers";
import { CoverError } from "./cover/cover-codes";
import {
  acceptCover,
  createCover,
  endCover,
  getActiveCover,
  listMyCovers,
  markCoverFace
} from "./cover/cover.service";
import { mobileSyncPreHandler } from "./mobile.route.shared";

const createBody = z.object({
  agent_user_id: z.number().int().positive().optional().nullable(),
  svr_user_id: z.number().int().positive().optional().nullable(),
  cover_date: z.string().optional().nullable()
});

const faceBody = z.object({ face_ok: z.boolean() });

function coverHttp(e: unknown): { status: number; code: string } | null {
  if (e instanceof CoverError) {
    if (e.code === "NOT_FOUND") return { status: 404, code: "NotFound" };
    return { status: 403, code: e.code };
  }
  return null;
}

function requireAgentOrSvr(role: string): boolean {
  return role === "agent" || role === "supervisor";
}

export async function registerMobileCoverRoutes(app: FastifyInstance) {
  app.post(
    "/api/:slug/mobile/cover",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!requireAgentOrSvr(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const body = createBody.safeParse(request.body ?? {});
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
        const row = await createCover({
          tenantId: request.tenant!.id,
          actorUserId: Number.parseInt(viewer.sub, 10),
          actorRole: viewer.role,
          agentUserId: body.data.agent_user_id,
          svrUserId: body.data.svr_user_id,
          coverDateIso: body.data.cover_date
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = coverHttp(e);
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code);
        throw e;
      }
    }
  );

  app.get(
    "/api/:slug/mobile/cover",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!requireAgentOrSvr(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const rows = await listMyCovers({
        tenantId: request.tenant!.id,
        userId: Number.parseInt(viewer.sub, 10)
      });
      return reply.send({ data: rows });
    }
  );

  app.get(
    "/api/:slug/mobile/cover/active",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!requireAgentOrSvr(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const row = await getActiveCover({
        tenantId: request.tenant!.id,
        userId: Number.parseInt(viewer.sub, 10)
      });
      return reply.send({ data: row });
    }
  );

  app.post(
    "/api/:slug/mobile/cover/:id/face",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!requireAgentOrSvr(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      const body = faceBody.safeParse(request.body ?? {});
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
        const row = await markCoverFace({
          tenantId: request.tenant!.id,
          userId: Number.parseInt(viewer.sub, 10),
          coverId: id,
          faceOk: body.data.face_ok
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = coverHttp(e);
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code);
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/cover/:id/accept",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!requireAgentOrSvr(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const row = await acceptCover({
          tenantId: request.tenant!.id,
          userId: Number.parseInt(viewer.sub, 10),
          coverId: id
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = coverHttp(e);
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code);
        throw e;
      }
    }
  );

  app.post(
    "/api/:slug/mobile/cover/:id/end",
    { preHandler: [...mobileSyncPreHandler] },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const viewer = getAccessUser(request);
      if (!requireAgentOrSvr(viewer.role)) {
        return sendApiError(reply, request, 403, "ForbiddenRole");
      }
      const id = Number((request.params as { id?: string }).id);
      if (!Number.isFinite(id) || id <= 0) {
        return sendApiError(reply, request, 400, "InvalidId");
      }
      try {
        const row = await endCover({
          tenantId: request.tenant!.id,
          userId: Number.parseInt(viewer.sub, 10),
          coverId: id
        });
        return reply.send({ data: row });
      } catch (e) {
        const mapped = coverHttp(e);
        if (mapped) return sendApiError(reply, request, mapped.status, mapped.code);
        throw e;
      }
    }
  );
}
