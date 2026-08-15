import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { authLoginBodySchema, authRefreshBodySchema } from "../../contracts/auth.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { getAccessUser, jwtAccessVerify } from "./auth.prehandlers";
import { MOBILE_FIELD_ROLES, hasActiveSessionForDevice, isSessionEnforcedRole } from "./app-access.service";
import { toFio } from "../staff/staff.shared.helpers";
import { login, logout, refresh } from "./auth.service";
import {
  clearRefreshTokenCookie,
  resolveRefreshTokenInput,
  setRefreshTokenCookie
} from "./auth-cookies";
import { resolveRequestOrigin } from "../mobile/app-release.service";
import { getActiveSlotForUser } from "../work-slots/work-slots.query";

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
        ip_address: ip,
        request_origin: resolveRequestOrigin(request.headers)
      });
      setRefreshTokenCookie(reply, result.refreshToken);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      if (msg === "TENANT_NOT_FOUND") {
        return sendApiError(reply, request, 404, msg);
      }
      if (msg === "INVALID_CREDENTIALS") {
        return sendApiError(
          reply,
          request,
          401,
          msg,
          "Неверный логин или пароль. Проверьте код компании, логин и пароль."
        );
      }
      if (msg === "APP_ACCESS_DENIED") {
        return sendApiError(reply, request, 403, msg, "Ilova kirish o‘chirilgan");
      }
      if (msg === "SESSION_LIMIT") {
        return sendApiError(
          reply,
          request,
          403,
          msg,
          "Лимит активных сессий исчерпан. Завершите вход на другом устройстве или попросите администратора закрыть лишние сессии."
        );
      }
      if (msg === "USER_NOT_ON_SLOT") {
        return sendApiError(
          reply,
          request,
          403,
          msg,
          "Пользователь не назначен на рабочее место. Обратитесь к администратору."
        );
      }
      throw error;
    }
  });

  app.post(`${base}/refresh`, async (request, reply) => {
    const parsed = authRefreshBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }
    const refreshToken = resolveRefreshTokenInput(request, parsed.data.refreshToken);
    if (!refreshToken) {
      return sendApiError(reply, request, 401, "INVALID_REFRESH");
    }

    try {
      const result = await refresh(app, { refreshToken });
      setRefreshTokenCookie(reply, result.refreshToken);
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      if (msg === "INVALID_REFRESH") {
        return sendApiError(reply, request, 401, msg);
      }
      if (msg === "APP_ACCESS_DENIED") {
        return sendApiError(reply, request, 403, msg, "Ilova kirish o‘chirilgan");
      }
      if (msg === "USER_NOT_ON_SLOT") {
        return sendApiError(
          reply,
          request,
          403,
          msg,
          "Пользователь не назначен на рабочее место. Обратитесь к администратору."
        );
      }
      throw error;
    }
  });

  app.post(`${base}/logout`, async (request, reply) => {
    const parsed = authRefreshBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }
    const refreshToken = resolveRefreshTokenInput(request, parsed.data.refreshToken);
    if (refreshToken) {
      await logout({ refreshToken });
    }
    clearRefreshTokenCookie(reply);
    return reply.status(204).send();
  });

  app.get(
    `${base}/me`,
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      const u = getAccessUser(request);
      const userId = Number(u.sub);
      const [row, userRow] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id: u.tenantId },
          select: { slug: true, name: true }
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            app_access: true,
            is_active: true,
            name: true,
            code: true,
            first_name: true,
            last_name: true,
            middle_name: true
          }
        })
      ]);
      if (!userRow?.is_active) {
        return sendApiError(reply, request, 401, "Unauthorized");
      }
      if (MOBILE_FIELD_ROLES.has(u.role) && userRow.app_access === false) {
        return sendApiError(reply, request, 403, "APP_ACCESS_DENIED", "Ilova kirish o‘chirilgan");
      }
      // Admindan tashqari barcha rollar — bitta qurilma/sessiya nazorati (web + mobil).
      // Aniq qurilma sessiyasi tekshiriladi: boshqa qurilmada kirilganda shu qurilma chiqariladi.
      if (isSessionEnforcedRole(u.role)) {
        const hasSession = await hasActiveSessionForDevice(u.tenantId, userId, u.did);
        if (!hasSession) {
          return sendApiError(reply, request, 401, "SESSION_REVOKED", "Сессия завершена. Войдите снова.");
        }
      }
      try {
        const { assertUserOnWorkSlot } = await import("../work-slots/work-slots.access-gate");
        await assertUserOnWorkSlot(u.tenantId, userId, u.role);
      } catch (e) {
        if (e instanceof Error && e.message === "USER_NOT_ON_SLOT") {
          return sendApiError(
            reply,
            request,
            403,
            "USER_NOT_ON_SLOT",
            "Пользователь не назначен на рабочее место. Обратитесь к администратору."
          );
        }
        throw e;
      }
      const slugFromJwt = typeof u.tenantSlug === "string" && u.tenantSlug.trim() !== "" ? u.tenantSlug.trim() : null;
      const slot = await getActiveSlotForUser(userId);
      const work_slot_id = slot?.slot_id ?? null;
      const work_slot_code = slot?.slot_code ?? null;
      return {
        user: {
          id: userId,
          name: userRow ? toFio(userRow) : "",
          login: u.login,
          role: u.role,
          tenantId: u.tenantId,
          tenantSlug: row?.slug ?? slugFromJwt,
          tenantName: row?.name ?? null,
          code: userRow?.code ?? null,
          work_slot_id,
          work_slot_code,
          app_access: userRow.app_access
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
