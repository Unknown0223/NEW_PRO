import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { sendApiError, zodValidationExtras } from "../../lib/api-error";
import { resolveTelegramIntakeScope } from "./telegram-bot.intake-scope";
import { lookupTelegramStaff, registerTelegramStaff } from "./telegram-bot.staff.service";
import { telegramBotCanDownloadIntake } from "./telegram-bot.bind";

const registerBody = z.object({
  slug: z.string().trim().min(1).max(64),
  login: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
  smart_code: z.string().trim().min(1).max(64),
  telegram_id: z.coerce.number().int().positive()
});

const lookupBody = z.object({
  telegram_id: z.coerce.number().int().positive()
});

function headerSecret(request: FastifyRequest): string {
  const raw = request.headers["x-telegram-bot-secret"];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === "string" ? v : "";
}

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function assertBotSecret(request: FastifyRequest): boolean {
  const expected = env.TELEGRAM_BOT_API_SECRET?.trim() ?? "";
  if (expected.length < 16) return false;
  return secretsEqual(headerSecret(request), expected);
}

const failStatus: Record<string, number> = {
  not_found: 401,
  bad_creds: 401,
  empty_password: 401,
  unbound: 404,
  inactive: 403,
  bad_role: 403,
  bad_smart: 403,
  telegram_taken: 409,
  staff_bound_other_telegram: 409
};

export async function registerTelegramBotRoutes(app: FastifyInstance) {
  const rate = {
    config: {
      rateLimit: {
        max: env.AUTH_LOGIN_RATE_MAX,
        timeWindow: env.AUTH_LOGIN_RATE_WINDOW_MS
      }
    }
  };

  app.post("/api/telegram-bot/staff/lookup", rate, async (request, reply) => {
    if (!assertBotSecret(request)) {
      return sendApiError(reply, request, 401, "BotUnauthorized", "Telegram bot API kaliti noto‘g‘ri.");
    }
    const parsed = lookupBody.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }
    const result = await lookupTelegramStaff(parsed.data.telegram_id);
    if (!result.ok) {
      return sendApiError(
        reply,
        request,
        failStatus[result.reason] ?? 400,
        result.reason,
        result.message
      );
    }
    return reply.send(result);
  });

  app.post("/api/telegram-bot/staff/register", rate, async (request, reply) => {
    if (!assertBotSecret(request)) {
      return sendApiError(reply, request, 401, "BotUnauthorized", "Telegram bot API kaliti noto‘g‘ri.");
    }
    const parsed = registerBody.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }
    const result = await registerTelegramStaff({
      tenantSlug: parsed.data.slug,
      login: parsed.data.login,
      password: parsed.data.password,
      smartCode: parsed.data.smart_code,
      telegramId: parsed.data.telegram_id
    });
    if (!result.ok) {
      return sendApiError(
        reply,
        request,
        failStatus[result.reason] ?? 400,
        result.reason,
        result.message,
        result.hint ? { hint: result.hint } : undefined
      );
    }
    return reply.send(result);
  });

  /** Platforma Dostup scope — bot Excel/statistika uchun agent_ids. */
  app.post("/api/telegram-bot/staff/intake-scope", rate, async (request, reply) => {
    if (!assertBotSecret(request)) {
      return sendApiError(reply, request, 401, "BotUnauthorized", "Telegram bot API kaliti noto‘g‘ri.");
    }
    const parsed = lookupBody.safeParse(request.body);
    if (!parsed.success) {
      return sendApiError(reply, request, 400, "ValidationError", "Invalid request body", zodValidationExtras(parsed.error));
    }
    const staff = await lookupTelegramStaff(parsed.data.telegram_id);
    if (!staff.ok) {
      return sendApiError(
        reply,
        request,
        failStatus[staff.reason] ?? 400,
        staff.reason,
        staff.message
      );
    }
    if (!telegramBotCanDownloadIntake(staff.user.role)) {
      return sendApiError(
        reply,
        request,
        403,
        "bad_role",
        "Excel/statistika agentdan boshqa rollar uchun (platforma scope)."
      );
    }
    const scope = await resolveTelegramIntakeScope({
      tenantId: staff.user.tenant_id,
      userId: staff.user.salec_user_id,
      role: staff.user.role
    });
    return reply.send({ ok: true, scope });
  });
}
