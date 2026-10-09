import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { ensureTenantContext } from "../../lib/tenant-context";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ADMIN_AND_OPERATOR_LIKE_ROLES } from "../../lib/tenant-user-roles";
import { jwtAccessVerify, requireRoles } from "../auth/auth.prehandlers";
import { maxSessionsBySlotTypeBodySchema, revokeWorkSlotSessionsBody } from "./work-slots.schema";
import {
  listWorkSlotSessions,
  revokeWorkSlotSessions,
  setMaxSessionsForSlotType
} from "./work-slots.sessions";

const manageRoles = [...ADMIN_AND_OPERATOR_LIKE_ROLES, "supervisor"] as const;
const idParams = z.object({ id: z.coerce.number().int().positive() });

function mapSessionError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  e: unknown
) {
  const msg = e instanceof Error ? e.message : "";
  if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
  if (msg === "NO_ACTIVE_USER") return sendApiError(reply, request, 409, "NoActiveUser");
  if (msg === "EMPTY_REVOKE") return sendApiError(reply, request, 400, "EmptyRevoke");
  if (msg === "BAD_SLOT_TYPE") return sendApiError(reply, request, 400, "ValidationError", msg);
  if (msg === "BAD_MAX_SESSIONS") return sendApiError(reply, request, 400, "BadMaxSessions");
  throw e;
}

/** Occupant sessiyalari — staff `/operators` emas (u faqat admin). */
export async function registerWorkSlotSessionRoutes(app: FastifyInstance) {
  const preManage = [jwtAccessVerify, requireRoles(...manageRoles)];

  app.get("/api/:slug/work-slots/:id/sessions", { preHandler: preManage }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const p = idParams.safeParse(request.params);
    if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
    try {
      const data = await listWorkSlotSessions(request.tenant!.id, p.data.id);
      return reply.send({ data });
    } catch (e) {
      return mapSessionError(reply, request, e);
    }
  });

  app.post(
    "/api/:slug/work-slots/:id/sessions/revoke",
    { preHandler: preManage },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const p = idParams.safeParse(request.params);
      if (!p.success) return sendApiError(reply, request, 400, "ValidationError");
      const parsed = revokeWorkSlotSessionsBody.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Request validation failed",
          zodValidationExtras(parsed.error)
        );
      }
      try {
        if ("all" in parsed.data && parsed.data.all) {
          await revokeWorkSlotSessions(
            request.tenant!.id,
            p.data.id,
            { all: true },
            actorUserIdOrNull(request)
          );
        } else if ("token_ids" in parsed.data) {
          await revokeWorkSlotSessions(
            request.tenant!.id,
            p.data.id,
            { tokenIds: parsed.data.token_ids },
            actorUserIdOrNull(request)
          );
        }
        return reply.status(204).send();
      } catch (e) {
        return mapSessionError(reply, request, e);
      }
    }
  );

  app.post(
    "/api/:slug/work-slots/sessions/max-by-type",
    { preHandler: preManage },
    async (request, reply) => {
      if (!ensureTenantContext(request, reply)) return;
      const parsed = maxSessionsBySlotTypeBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          undefined,
          zodValidationExtras(parsed.error)
        );
      }
      try {
        const data = await setMaxSessionsForSlotType(
          request.tenant!.id,
          parsed.data.slot_type,
          parsed.data.max_sessions,
          actorUserIdOrNull(request)
        );
        return reply.send({ data });
      } catch (e) {
        return mapSessionError(reply, request, e);
      }
    }
  );
}
