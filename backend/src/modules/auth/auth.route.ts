import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { authLoginBodySchema, authRefreshBodySchema } from "../../contracts/auth.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { getAccessUser, jwtAccessVerify } from "./auth.prehandlers";
import { login, logout, refresh } from "./auth.service";

const AUTH_PREFIXES = ["/auth", "/api/auth"] as const;

const loginRouteOpts = {
  config: {
    rateLimit: {
      max: env.AUTH_LOGIN_RATE_MAX,
      timeWindow: env.AUTH_LOGIN_RATE_WINDOW_MS
    }
  }
};

function registerAuthAtBase(app: FastifyInstance, base: string) {
  app.post(`${base}/login`, loginRouteOpts, async (request, reply) => {
    const parsed = authLoginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }

    try {
      const ip =
        (request.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        request.ip ||
        null;
      const result = await login(app, {
        ...parsed.data,
        ip_address: ip
      });
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      if (msg === "TENANT_NOT_FOUND") {
        return sendApiError(reply, request, 404, msg);
      }
      if (msg === "INVALID_CREDENTIALS") {
        return sendApiError(reply, request, 401, msg);
      }
      if (msg === "SESSION_LIMIT") {
        return sendApiError(reply, request, 403, msg);
      }
      throw error;
    }
  });

  app.post(`${base}/refresh`, async (request, reply) => {
    const parsed = authRefreshBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }

    try {
      const result = await refresh(app, parsed.data);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      if (msg === "INVALID_REFRESH") {
        return sendApiError(reply, request, 401, msg);
      }
      throw error;
    }
  });

  app.post(`${base}/logout`, async (request, reply) => {
    const parsed = authRefreshBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }

    await logout(parsed.data);
    return reply.status(204).send();
  });

  app.get(
    `${base}/me`,
    { preHandler: [jwtAccessVerify] },
    async (request, _reply) => {
      const u = getAccessUser(request);
      const userId = Number(u.sub);
      const row = await prisma.tenant.findUnique({
        where: { id: u.tenantId },
        select: { slug: true }
      });
      const slugFromJwt = typeof u.tenantSlug === "string" && u.tenantSlug.trim() !== "" ? u.tenantSlug.trim() : null;
      let work_slot_id: number | null = null;
      let work_slot_code: string | null = null;
      if (Number.isFinite(userId) && userId > 0) {
        const { loadActiveWorkSlotsByUserIds } = await import("../work-slots/work-slots.query");
        const slotMap = await loadActiveWorkSlotsByUserIds([userId]);
        const slot = slotMap.get(userId);
        work_slot_id = slot?.slot_id ?? null;
        work_slot_code = slot?.slot_code ?? null;
      }
      return {
        user: {
          id: userId,
          login: u.login,
          role: u.role,
          tenantId: u.tenantId,
          tenantSlug: row?.slug ?? slugFromJwt,
          work_slot_id,
          work_slot_code
        }
      };
    }
  );
}

export async function registerAuthRoutes(app: FastifyInstance) {
  for (const prefix of AUTH_PREFIXES) {
    registerAuthAtBase(app, prefix);
  }
}
