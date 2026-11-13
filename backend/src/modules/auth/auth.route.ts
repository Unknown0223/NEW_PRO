import type { FastifyInstance } from "fastify";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import {
  authChangePasswordBodySchema,
  authLoginBodySchema,
  authRefreshBodySchema
} from "../../contracts/auth.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { getAccessUser, jwtAccessVerify } from "./auth.prehandlers";
import {
  MOBILE_FIELD_ROLES,
  hasActiveSessionForDevice,
  isSessionEnforcedRole,
  touchActiveRefreshSessions
} from "./app-access.service";
import { toFio } from "../staff/staff.shared.helpers";
import { changeOwnPassword, login, logout, refresh } from "./auth.service";
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
      timeWindow: env.AUTH_LOGIN_RATE_WINDOW_MS,
      /** IP + tenant slug + login — bitta proxy ortida barcha agentlar bloklanmasin. */
      keyGenerator: (request: { ip: string; body?: unknown }) => {
        const body = (request.body ?? {}) as { slug?: unknown; login?: unknown };
        const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
        const login = typeof body.login === "string" ? body.login.trim().toLowerCase() : "";
        return `${request.ip}|${slug}|${login}`;
      }
    }
  }
};

function registerAuthAtBase(app: FastifyInstance, base: string) {
  app.post(`${base}/login`, loginRouteOpts, async (request, reply) => {
    const parsed = authLoginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Некорректные данные запроса", zodValidationExtras(parsed.error));
    }

    try {
      const result = await login(app, {
        ...parsed.data,
        ip_address: request.ip || null,
        request_origin: resolveRequestOrigin(request.headers),
        request_headers: {
          origin: request.headers.origin,
          "x-forwarded-proto": request.headers["x-forwarded-proto"],
          "x-forwarded-host": request.headers["x-forwarded-host"],
          host: request.headers.host
        }
      });
      /* Face ID challenge — access/refresh hali yo‘q; cookie qo‘ymaymiz. */
      if (
        result &&
        typeof result === "object" &&
        "face_required" in result &&
        (result as { face_required?: boolean }).face_required === true
      ) {
        return reply.send(result);
      }
      const tokens = result as { refreshToken?: string };
      if (tokens.refreshToken) setRefreshTokenCookie(reply, tokens.refreshToken);
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
      if (msg === "ACCOUNT_LOCKED") {
        return sendApiError(
          reply,
          request,
          429,
          msg,
          "Слишком много неудачных попыток. Попробуйте позже."
        );
      }
      if (msg === "APP_ACCESS_DENIED") {
        return sendApiError(reply, request, 403, msg, "Доступ к приложению отключён");
      }
      if (msg === "WEB_ACCESS_DENIED") {
        const { WEB_ACCESS_DENIED_MESSAGE } = await import("./web-panel-access");
        return sendApiError(reply, request, 403, msg, WEB_ACCESS_DENIED_MESSAGE);
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
      return sendApiError(reply, request, 400, "ValidationError", "Некорректные данные запроса", zodValidationExtras(parsed.error));
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
      if (msg === "REFRESH_REUSE_DETECTED") {
        return sendApiError(
          reply,
          request,
          401,
          msg,
          "Сессия отозвана: обнаружено повторное использование токена"
        );
      }
      if (msg === "APP_ACCESS_DENIED") {
        return sendApiError(reply, request, 403, msg, "Доступ к приложению отключён");
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
      return sendApiError(reply, request, 400, "ValidationError", "Некорректные данные запроса", zodValidationExtras(parsed.error));
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
            middle_name: true,
            must_change_password: true
          }
        })
      ]);
      if (!userRow?.is_active) {
        return sendApiError(reply, request, 401, "Unauthorized");
      }
      if (MOBILE_FIELD_ROLES.has(u.role) && userRow.app_access === false) {
        return sendApiError(reply, request, 403, "APP_ACCESS_DENIED", "Доступ к приложению отключён");
      }
      // Chiqish faqat: o‘zi chiqdi yoki admin webdan barcha sessiyani yopdi.
      if (isSessionEnforcedRole(u.role)) {
        const hasSession = await hasActiveSessionForDevice(u.tenantId, userId, u.did);
        if (!hasSession) {
          return sendApiError(reply, request, 401, "SESSION_REVOKED", "Сессия завершена. Войдите снова.");
        }
        void touchActiveRefreshSessions(u.tenantId, userId, u.did);
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
          app_access: userRow.app_access,
          must_change_password: userRow.must_change_password === true
        }
      };
    }
  );

  app.post(
    `${base}/change-password`,
    { preHandler: [jwtAccessVerify] },
    async (request, reply) => {
      const parsed = authChangePasswordBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return sendApiError(
          reply,
          request,
          400,
          "ValidationError",
          "Некорректные данные запроса",
          zodValidationExtras(parsed.error)
        );
      }
      const u = getAccessUser(request);
      try {
        await changeOwnPassword(u.tenantId, Number(u.sub), parsed.data);
        return reply.send({ ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "NOT_FOUND") return sendApiError(reply, request, 404, "NotFound");
        if (msg === "VALIDATION") {
          return sendApiError(
            reply,
            request,
            400,
            "ValidationError",
            "Пароль: минимум 8 символов, буква и цифра"
          );
        }
        if (msg === "INVALID_OLD_PASSWORD") {
          return sendApiError(reply, request, 400, "ValidationError", "Неверный текущий пароль");
        }
        throw e;
      }
    }
  );
}

export async function registerAuthRoutes(app: FastifyInstance) {
  for (const prefix of AUTH_PREFIXES) {
    registerAuthAtBase(app, prefix);
  }
  const { registerFaceLoginRoutes } = await import("./face-login.route");
  await registerFaceLoginRoutes(app);
}
