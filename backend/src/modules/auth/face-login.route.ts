import type { FastifyInstance } from "fastify";
import {
  faceLoginCompleteBodySchema,
  faceLoginRecreateBodySchema,
  faceLoginStatusQuerySchema,
  faceLoginVerifyBodySchema
} from "../../contracts/face-login.schemas";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { env } from "../../config/env";
import { resolveRequestOrigin } from "../mobile/app-release.service";
import { setRefreshTokenCookie } from "./auth-cookies";
import {
  completeFaceLoginChallenge,
  getFaceLoginStatus,
  recreateFaceLoginChallenge,
  verifyFaceLoginChallenge
} from "./face-login.service";

const AUTH_PREFIXES = ["/auth", "/api/auth"] as const;

const faceVerifyRateOpts = {
  config: {
    rateLimit: {
      max: Math.min(20, env.AUTH_LOGIN_RATE_MAX),
      timeWindow: env.AUTH_LOGIN_RATE_WINDOW_MS,
      keyGenerator: (request: { ip: string; body?: unknown }) => {
        const body = (request.body ?? {}) as { challenge_token?: unknown };
        const tok =
          typeof body.challenge_token === "string" ? body.challenge_token.slice(0, 24) : "";
        return `${request.ip}|face-verify|${tok}`;
      }
    }
  }
};

function mapFaceError(
  reply: Parameters<typeof sendApiError>[0],
  request: Parameters<typeof sendApiError>[1],
  msg: string
) {
  if (msg === "FACE_CHALLENGE_NOT_FOUND") {
    return sendApiError(reply, request, 404, msg, "Сессия Face ID не найдена");
  }
  if (msg === "FACE_CHALLENGE_EXPIRED") {
    return sendApiError(reply, request, 410, msg, "Срок проверки Face ID истёк. Войдите снова.");
  }
  if (msg === "FACE_CHALLENGE_ALREADY_USED") {
    return sendApiError(reply, request, 409, msg, "Проверка Face ID уже использована");
  }
  if (msg === "FACE_CHALLENGE_REJECTED") {
    return sendApiError(reply, request, 403, msg, "Проверка Face ID отклонена");
  }
  if (msg === "FACE_CHALLENGE_NOT_APPROVED") {
    return sendApiError(reply, request, 409, msg, "Face ID ещё не подтверждён");
  }
  if (msg === "FACE_LIVENESS_FAILED") {
    return sendApiError(reply, request, 403, msg, "Проверка живости не пройдена. Повторите повороты головы.");
  }
  if (msg === "FACE_MISMATCH") {
    return sendApiError(
      reply,
      request,
      403,
      msg,
      "Лицо не совпало с эталоном. Выровняйте лицо и повторите, либо обновите эталон."
    );
  }
  if (msg === "REFERENCE_MISSING") {
    return sendApiError(
      reply,
      request,
      403,
      msg,
      "Нет эталонного фото Face ID. Обратитесь к администратору."
    );
  }
  if (msg === "FACE_IMAGE_BLANK" || msg === "FACE_NOT_DETECTED") {
    return sendApiError(
      reply,
      request,
      400,
      msg,
      "Лицо не найдено на фото. Выровняйте лицо в овале и повторите."
    );
  }
  if (msg === "SESSION_LIMIT") {
    return sendApiError(
      reply,
      request,
      403,
      msg,
      "Лимит активных сессий исчерпан. Завершите вход на другом устройстве."
    );
  }
  return null;
}

function registerFaceLoginAtBase(app: FastifyInstance, base: string) {
  app.get(`${base}/face-login/status`, async (request, reply) => {
    const parsed = faceLoginStatusQuerySchema.safeParse(request.query ?? {});
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
    try {
      const data = await getFaceLoginStatus(parsed.data.challenge_token);
      return reply.send({ data });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      const mapped = mapFaceError(reply, request, msg);
      if (mapped) return mapped;
      throw error;
    }
  });

  app.post(`${base}/face-login/verify`, faceVerifyRateOpts, async (request, reply) => {
    const parsed = faceLoginVerifyBodySchema.safeParse(request.body ?? {});
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
    try {
      const result = await verifyFaceLoginChallenge(app, parsed.data);
      if ("refreshToken" in result && typeof result.refreshToken === "string") {
        setRefreshTokenCookie(reply, result.refreshToken);
      }
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      const mapped = mapFaceError(reply, request, msg);
      if (mapped) return mapped;
      throw error;
    }
  });

  app.post(`${base}/face-login/complete`, faceVerifyRateOpts, async (request, reply) => {
    const parsed = faceLoginCompleteBodySchema.safeParse(request.body ?? {});
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
    try {
      const result = await completeFaceLoginChallenge(app, parsed.data.challenge_token);
      if ("refreshToken" in result && typeof result.refreshToken === "string") {
        setRefreshTokenCookie(reply, result.refreshToken);
      }
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      const mapped = mapFaceError(reply, request, msg);
      if (mapped) return mapped;
      throw error;
    }
  });

  app.post(`${base}/face-login/recreate`, faceVerifyRateOpts, async (request, reply) => {
    const parsed = faceLoginRecreateBodySchema.safeParse(request.body ?? {});
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
    try {
      const result = await recreateFaceLoginChallenge({
        challenge_token: parsed.data.challenge_token,
        publicOrigin: resolveRequestOrigin(request.headers),
        headers: {
          origin: request.headers.origin,
          "x-forwarded-proto": request.headers["x-forwarded-proto"],
          "x-forwarded-host": request.headers["x-forwarded-host"],
          host: request.headers.host
        }
      });
      return reply.send(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "UNKNOWN";
      const mapped = mapFaceError(reply, request, msg);
      if (mapped) return mapped;
      throw error;
    }
  });
}

export async function registerFaceLoginRoutes(app: FastifyInstance) {
  for (const prefix of AUTH_PREFIXES) {
    registerFaceLoginAtBase(app, prefix);
  }
}
