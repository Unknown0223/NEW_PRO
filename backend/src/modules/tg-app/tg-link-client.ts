import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { findPermissionHolderIds, notifyUsers } from "../payroll/payroll.notify";
import { tgSend, type TgContact } from "./tg-api";
import { logAttempt, recentFailTimes } from "./tg-identity";
import {
  LIMITS,
  blockUntil,
  contactIsOwn,
  decideClientLinkStart,
  formatLinkCode,
  generateLinkCode,
  hashLinkCode,
  normLinkCode,
  orderNumberMatches,
  phoneMatchesClient
} from "./tg-link.pure";
import { addJunk, clearState, dropIncoming, flash, setState, show, type ChatCtx } from "./tg-screen";
import { t } from "./tg-text";
import { btn, cb, esc, kb, maskName, phoneKey } from "./tg-ui.pure";

export const CLIENT_APPROVE_PERMISSION = "clients.klient.update";

/** Ulanish kodi yaratish (web paneldan yoki nakladnoy uchun). Kodning o'zi faqat bir marta qaytariladi. */
export async function createClientLinkCode(input: {
  tenantId: number;
  clientId: number;
  actorUserId: number | null;
  source: "manual" | "invoice";
}): Promise<{ code: string; display: string; expires_at: Date }> {
  const ttlH = input.source === "invoice" ? LIMITS.invoiceCodeTtlHours : LIMITS.manualCodeTtlHours;
  for (let i = 0; i < 5; i++) {
    const code = generateLinkCode();
    try {
      const row = await prisma.tgLinkCode.create({
        data: {
          tenant_id: input.tenantId,
          client_id: input.clientId,
          code_hash: hashLinkCode(input.tenantId, code),
          source: input.source,
          created_by: input.actorUserId,
          expires_at: new Date(Date.now() + ttlH * 3600_000)
        }
      });
      return { code, display: formatLinkCode(code), expires_at: row.expires_at };
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("link_code_collision");
}

/** Blok bo'lsa — qolgan daqiqalar, aks holda 0. */
export async function blockedMinutes(ctx: ChatCtx): Promise<number> {
  const until = blockUntil(await recentFailTimes(ctx.telegramId));
  if (!until) return 0;
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
}

async function fail(ctx: ChatCtx, kind: string, reason: string, clientId?: number) {
  await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind, ok: false, reason, clientId });
}

const cancelKb = (ctx: ChatCtx) => kb([btn(t(ctx.lang, "cancel"), cb("m", "home"), "danger")]);

export async function askClientCode(ctx: ChatCtx): Promise<void> {
  await setState(ctx, { step: "client_code" });
  await show(ctx, { text: t(ctx.lang, "askCode"), kb: cancelKb(ctx) });
}

export async function onClientCode(ctx: ChatCtx, raw: string, fresh: boolean): Promise<void> {
  const mins = await blockedMinutes(ctx);
  if (mins > 0) {
    await show(ctx, { text: t(ctx.lang, "blocked", { min: mins }), kb: cancelKb(ctx) }, { fresh });
    return;
  }
  const code = normLinkCode(raw);
  const row = code
    ? await prisma.tgLinkCode.findUnique({ where: { code_hash: hashLinkCode(ctx.tenantId, code) } })
    : null;
  const codeRow = row && row.tenant_id === ctx.tenantId ? row : null;

  const [staffLink, client, linksForClient, linksForTg] = await Promise.all([
    prisma.telegramStaffLink.findUnique({ where: { telegram_id: ctx.telegramId }, select: { id: true } }),
    codeRow
      ? prisma.client.findFirst({
          where: { id: codeRow.client_id, tenant_id: ctx.tenantId },
          select: { id: true, name: true, is_active: true, merged_into_client_id: true }
        })
      : null,
    codeRow
      ? prisma.tgClientLink.findMany({
          where: { tenant_id: ctx.tenantId, client_id: codeRow.client_id, status: { in: ["active", "pending"] } },
          select: { telegram_id: true }
        })
      : [],
    prisma.tgClientLink.count({ where: { telegram_id: ctx.telegramId, status: { in: ["active", "pending"] } } })
  ]);

  const already = linksForClient.some((l) => l.telegram_id === ctx.telegramId);
  const d = decideClientLinkStart({
    telegramIsStaff: Boolean(staffLink),
    code: codeRow,
    clientActive: Boolean(client?.is_active && client.merged_into_client_id == null),
    activeLinksForClient: linksForClient.length,
    activeLinksForTelegram: linksForTg,
    alreadyLinkedThisClient: already
  });

  if (!d.ok) {
    await fail(ctx, "client_code", d.reason, codeRow?.client_id);
    const key =
      d.reason === "staff_telegram"
        ? "staffCantBeClient"
        : d.reason === "too_many_for_client" || d.reason === "too_many_for_telegram"
          ? "tooManyLinks"
          : "codeBad";
    await setState(ctx, { step: "client_code" });
    await show(ctx, { text: `${t(ctx.lang, key)}\n\n${t(ctx.lang, "askCode")}`, kb: cancelKb(ctx) }, { fresh });
    return;
  }
  if (d.already) {
    await clearState(ctx);
    await flash(ctx, t(ctx.lang, "alreadyLinked"), 5);
    return;
  }
  await setState(ctx, { step: "client_order", data: { codeId: codeRow!.id, clientId: client!.id } });
  await show(ctx, { text: t(ctx.lang, "askOrder", { name: esc(maskName(client!.name)) }), kb: cancelKb(ctx) }, { fresh });
}

export async function onClientOrder(ctx: ChatCtx, text: string, incomingId: number): Promise<void> {
  await dropIncoming(ctx, incomingId);
  const codeId = Number(ctx.state.data?.codeId);
  const clientId = Number(ctx.state.data?.clientId);
  const code = await prisma.tgLinkCode.findFirst({ where: { id: codeId, tenant_id: ctx.tenantId, client_id: clientId } });
  if (!code || code.used_at || code.expires_at <= new Date() || code.attempts >= LIMITS.maxCodeAttempts) {
    await askClientCode(ctx);
    return;
  }
  const since = new Date(Date.now() - LIMITS.orderLookbackDays * 86400_000);
  const orders = await prisma.order.findMany({
    where: {
      tenant_id: ctx.tenantId,
      client_id: clientId,
      order_type: "order",
      status: { in: ["delivered", "delivering"] },
      created_at: { gte: since }
    },
    select: { number: true },
    take: 500
  });
  const ok = orders.some((o) => orderNumberMatches(text, o.number));
  if (!ok) {
    const upd = await prisma.tgLinkCode.update({ where: { id: code.id }, data: { attempts: { increment: 1 } } });
    await fail(ctx, "client_order", "order_mismatch", clientId);
    const left = Math.max(0, LIMITS.maxCodeAttempts - upd.attempts);
    if (left === 0) {
      await askClientCode(ctx);
      await flash(ctx, t(ctx.lang, "codeBad"), 8);
      return;
    }
    await show(ctx, { text: `${t(ctx.lang, "orderBad", { left })}`, kb: cancelKb(ctx) }, { fresh: true });
    return;
  }
  await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind: "client_order", ok: true, clientId });
  await setState(ctx, { step: "client_phone", data: { codeId, clientId } });
  await show(
    ctx,
    { text: t(ctx.lang, "askPhone"), kb: kb([btn(t(ctx.lang, "skipPhone"), cb("l", "skip"))], [btn(t(ctx.lang, "cancel"), cb("m", "home"), "danger")]) },
    { fresh: true }
  );
  const msgId = await flash(ctx, "👇", 900, {
    keyboard: [[{ text: t(ctx.lang, "sharePhone"), request_contact: true, style: "success" }]],
    resize_keyboard: true,
    one_time_keyboard: true
  });
  if (msgId) ctx.state.data = { ...ctx.state.data, kbMsg: msgId };
  await setState(ctx, ctx.state);
}

async function removeReplyKeyboard(ctx: ChatCtx): Promise<void> {
  try {
    const m = await tgSend(ctx.chatId, "✔️", { remove_keyboard: true });
    await addJunk(ctx, m.message_id, 1);
  } catch (e) {
    logger.debug({ err: e }, "tg remove keyboard failed");
  }
}

export async function onClientContact(ctx: ChatCtx, contact: TgContact | null, fromId: number, incomingId?: number): Promise<void> {
  if (incomingId) await dropIncoming(ctx, incomingId);
  const codeId = Number(ctx.state.data?.codeId);
  const clientId = Number(ctx.state.data?.clientId);
  if (contact && !contactIsOwn(contact.user_id, fromId)) {
    await fail(ctx, "client_phone", "foreign_contact", clientId);
    await flash(ctx, t(ctx.lang, "phoneNotYours"), 8);
    return;
  }
  const code = await prisma.tgLinkCode.findFirst({ where: { id: codeId, tenant_id: ctx.tenantId, client_id: clientId } });
  if (!code || code.used_at || code.expires_at <= new Date()) {
    await removeReplyKeyboard(ctx);
    await askClientCode(ctx);
    return;
  }
  const shared = contact ? phoneKey(contact.phone_number) : null;

  if (shared) {
    const staff = await prisma.user.findMany({
      where: { tenant_id: ctx.tenantId, phone: { not: null } },
      select: { id: true, phone: true, name: true }
    });
    const hit = staff.find((u) => phoneKey(u.phone) === shared);
    if (hit) {
      await fail(ctx, "client_phone", "staff_phone", clientId);
      await prisma.tgLinkCode.update({ where: { id: code.id }, data: { attempts: LIMITS.maxCodeAttempts } });
      const admins = await findPermissionHolderIds(ctx.tenantId, [CLIENT_APPROVE_PERMISSION]);
      await notifyUsers(ctx.tenantId, admins, {
        title: "⚠️ Telegram: xodim raqami bilan mijozga ulanish urinishi",
        body: `Xodim: ${hit.name}. Mijoz #${clientId}. Kod bloklandi.`,
        href: `/clients/${clientId}`
      });
      await removeReplyKeyboard(ctx);
      await clearState(ctx);
      await show(ctx, { text: t(ctx.lang, "staffCantBeClient"), kb: kb([btn(t(ctx.lang, "home"), cb("m", "home"))]) }, { fresh: true });
      return;
    }
  }

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenant_id: ctx.tenantId },
    select: { id: true, name: true, phone: true, phone_normalized: true, agent_id: true, contact_persons: true }
  });
  if (!client) {
    await askClientCode(ctx);
    return;
  }
  const contactPhones = Array.isArray(client.contact_persons)
    ? (client.contact_persons as Array<{ phone?: string }>).map((c) => phoneKey(c?.phone))
    : [];
  const match = phoneMatchesClient(shared, [phoneKey(client.phone), phoneKey(client.phone_normalized), ...contactPhones]);
  const status = match ? "active" : "pending";

  await prisma.$transaction([
    prisma.tgLinkCode.update({ where: { id: code.id }, data: { used_at: new Date(), used_by_telegram_id: ctx.telegramId } }),
    prisma.tgClientLink.upsert({
      where: { tenant_id_client_id_telegram_id: { tenant_id: ctx.tenantId, client_id: clientId, telegram_id: ctx.telegramId } },
      create: {
        tenant_id: ctx.tenantId,
        client_id: clientId,
        telegram_id: ctx.telegramId,
        status,
        phone: contact?.phone_number?.slice(0, 32) ?? null,
        phone_match: match,
        code_id: code.id
      },
      update: {
        status,
        phone: contact?.phone_number?.slice(0, 32) ?? null,
        phone_match: match,
        code_id: code.id,
        linked_at: new Date(),
        revoked_at: null,
        revoked_by: null,
        revoke_reason: null
      }
    }),
    prisma.tgChat.update({ where: { telegram_id: ctx.telegramId }, data: { active_client_id: match ? clientId : undefined } })
  ]);
  await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind: "client_link", ok: true, reason: status, clientId });

  const notifyIds = match
    ? client.agent_id
      ? [client.agent_id]
      : []
    : [...(await findPermissionHolderIds(ctx.tenantId, [CLIENT_APPROVE_PERMISSION])), ...(client.agent_id ? [client.agent_id] : [])];
  await notifyUsers(ctx.tenantId, notifyIds, {
    title: match ? `🤝 ${client.name} Telegram botga ulandi` : `⏳ ${client.name}: Telegram ulanishni tasdiqlash kerak`,
    body: match ? "Telefon raqami mos keldi." : "Telefon raqami mos kelmadi — mijoz kartochkasida tasdiqlang yoki rad eting.",
    href: `/clients/${clientId}`
  });

  await removeReplyKeyboard(ctx);
  await clearState(ctx);
  if (match) {
    await flash(ctx, t(ctx.lang, "linkedOk"), 6);
    await flash(ctx, t(ctx.lang, "linkedOkText", { name: esc(client.name) }), 8);
  }
}

export function linkPendingView(ctx: ChatCtx) {
  return {
    text: t(ctx.lang, "pendingWait"),
    kb: kb([btn(t(ctx.lang, "refresh"), cb("m", "home"), "primary")], [btn(t(ctx.lang, "cancel"), cb("x", "unlink"), "danger")])
  };
}
