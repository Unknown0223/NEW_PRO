import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { prisma } from "../../config/database";
import { env } from "../../config/env";
import { sendApiError } from "../../lib/api-error";
import { actorUserIdOrNull } from "../../lib/request-actor";
import { ensureTenantContext } from "../../lib/tenant-context";
import { assertClientAllowedForActor } from "../access/access-agent-scope";
import { getAccessUser, jwtAccessVerify } from "../auth/auth.prehandlers";
import { appendClientAuditLog } from "../clients/clients.audit";
import { tgEnabled, type TgUpdate } from "./tg-api";
import { resolveBotTenant } from "./tg-identity";
import { createClientLinkCode } from "./tg-link-client";
import { notifyTelegramRaw } from "./tg-notify";
import { acceptWebhookUpdate, tgAppBotUsername } from "./tg-runner";

function secretOk(request: FastifyRequest): boolean {
  const expected = env.TG_APP_WEBHOOK_SECRET ?? "";
  const raw = request.headers["x-telegram-bot-api-secret-token"];
  const got = Array.isArray(raw) ? raw[0] : raw;
  if (expected.length < 16 || typeof got !== "string") return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const posInt = (v: unknown) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function clientGuard(request: FastifyRequest): Promise<{ tenantId: number; clientId: number; actorId: number | null } | null> {
  const tenantId = request.tenant!.id;
  const clientId = posInt((request.params as { id?: string }).id);
  if (!clientId) return null;
  const viewer = getAccessUser(request);
  const actorId = actorUserIdOrNull(request);
  await assertClientAllowedForActor(tenantId, clientId, { userId: actorId, role: viewer.role ?? "" });
  const exists = await prisma.client.findFirst({ where: { id: clientId, tenant_id: tenantId }, select: { id: true } });
  return exists ? { tenantId, clientId, actorId } : null;
}

function scopeError(e: unknown): string | null {
  if (e instanceof Error && (e.message === "CLIENT_OUT_OF_SCOPE" || e.message === "NOT_FOUND")) return e.message;
  return null;
}

export async function registerTgAppRoutes(app: FastifyInstance) {
  app.post("/api/tg-app/webhook", { bodyLimit: 1_000_000 }, async (request, reply) => {
    if (!tgEnabled() || env.TG_APP_MODE !== "webhook" || !secretOk(request)) return reply.code(401).send({ ok: false });
    const body = request.body as TgUpdate | null;
    if (body && typeof body.update_id === "number") acceptWebhookUpdate(body);
    return reply.send({ ok: true });
  });

  app.get("/api/:slug/clients/:id/telegram", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    try {
      const g = await clientGuard(request);
      if (!g) return sendApiError(reply, request, 404, "NotFound");
      const tenant = await resolveBotTenant();
      const links = await prisma.tgClientLink.findMany({
        where: { tenant_id: g.tenantId, client_id: g.clientId, status: { in: ["active", "pending"] } },
        orderBy: { linked_at: "desc" },
        select: { id: true, status: true, phone: true, phone_match: true, linked_at: true, last_seen_at: true, approved_at: true }
      });
      return reply.send({
        enabled: tgEnabled() && tenant?.id === g.tenantId,
        bot_username: tgEnabled() ? await tgAppBotUsername() : null,
        links
      });
    } catch (e) {
      if (scopeError(e)) return sendApiError(reply, request, 403, "Forbidden");
      throw e;
    }
  });

  app.post("/api/:slug/clients/:id/telegram/code", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    try {
      const g = await clientGuard(request);
      if (!g) return sendApiError(reply, request, 404, "NotFound");
      const tenant = await resolveBotTenant();
      if (!tgEnabled() || tenant?.id !== g.tenantId) return sendApiError(reply, request, 409, "TelegramBotDisabled");
      const code = await createClientLinkCode({ tenantId: g.tenantId, clientId: g.clientId, actorUserId: g.actorId, source: "manual" });
      const username = await tgAppBotUsername();
      await appendClientAuditLog(g.tenantId, g.clientId, g.actorId, "client.telegram_code", { expires_at: code.expires_at });
      return reply.send({
        code: code.display,
        expires_at: code.expires_at.toISOString(),
        deep_link: username ? `https://t.me/${username}?start=c_${code.code}` : null
      });
    } catch (e) {
      if (scopeError(e)) return sendApiError(reply, request, 403, "Forbidden");
      throw e;
    }
  });

  app.post("/api/:slug/clients/:id/telegram/links/:linkId/:action", { preHandler: [jwtAccessVerify] }, async (request, reply) => {
    if (!ensureTenantContext(request, reply)) return;
    const params = request.params as { linkId?: string; action?: string };
    const linkId = posInt(params.linkId);
    const action = params.action;
    if (!linkId || (action !== "approve" && action !== "revoke")) return sendApiError(reply, request, 400, "BadRequest");
    try {
      const g = await clientGuard(request);
      if (!g) return sendApiError(reply, request, 404, "NotFound");
      const link = await prisma.tgClientLink.findFirst({ where: { id: linkId, tenant_id: g.tenantId, client_id: g.clientId } });
      if (!link) return sendApiError(reply, request, 404, "NotFound");
      if (action === "approve") {
        if (link.status !== "pending") return sendApiError(reply, request, 409, "NotPending");
        const staff = await prisma.telegramStaffLink.findUnique({ where: { telegram_id: link.telegram_id }, select: { id: true } });
        if (staff) return sendApiError(reply, request, 409, "TelegramIsStaff");
        await prisma.tgClientLink.update({ where: { id: link.id }, data: { status: "active", approved_by: g.actorId, approved_at: new Date() } });
        await notifyTelegramRaw(g.tenantId, link.telegram_id, "other", {
          uz: "✅ <b>Ulanish tasdiqlandi!</b>\nMenyu orqali ma’lumotlaringizni ko‘ring.",
          ru: "✅ <b>Подключение подтверждено!</b>\nОткройте меню, чтобы увидеть данные."
        }).catch(() => undefined);
      } else {
        await prisma.tgClientLink.update({
          where: { id: link.id },
          data: { status: "revoked", revoked_by: g.actorId, revoked_at: new Date(), revoke_reason: "web" }
        });
      }
      await appendClientAuditLog(g.tenantId, g.clientId, g.actorId, `client.telegram_${action}`, { link_id: link.id });
      return reply.send({ ok: true });
    } catch (e) {
      if (scopeError(e)) return sendApiError(reply, request, 403, "Forbidden");
      throw e;
    }
  });
}
