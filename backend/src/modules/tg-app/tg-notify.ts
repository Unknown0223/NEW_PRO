import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { TgApiError, tgCall, tgDelete, tgEnabled, type TgInlineKeyboard, type TgMessage } from "./tg-api";
import { resolveBotTenant } from "./tg-identity";
import { readPrefs } from "./tg-prefs.pure";
import { normLang, type Lang } from "./tg-text";
import { btn, cb, clip, esc, kb, localHour, money } from "./tg-ui.pure";

const DELETE_WINDOW_MS = 47 * 3600 * 1000;

export type NotifyType = "order" | "payment" | "consignment" | "reminder" | "bonus" | "payroll" | "task" | "other";

/** Web bildirishnoma havolasidan turini aniqlash. */
export function classifyNotification(linkHref: string | null | undefined, title = ""): NotifyType {
  const h = String(linkHref ?? "").toLowerCase();
  const s = title.toLowerCase();
  if (h.includes("/payroll") || s.includes("зарплат") || s.includes("аванс") || s.includes("oylik") || s.includes("avans")) return "payroll";
  if (h.includes("bonus") || s.includes("бонус") || s.includes("bonus")) return "bonus";
  if (h.includes("consignment") || s.includes("консигнац") || s.includes("konsignat")) return "consignment";
  if (h.includes("/tasks")) return "task";
  if (h.includes("/payments") || h.includes("/cash")) return "payment";
  if (h.includes("/orders")) return "order";
  return "other";
}

/** Tungi rejim: 22:00–08:00 — ovozsiz yuboriladi. */
export function isQuietNow(quiet: boolean, now = new Date()): boolean {
  if (!quiet) return false;
  const h = localHour(now);
  return h >= 22 || h < 8;
}

/** Faqat holati yangilanadigan obyektlar uchun eski xabar almashtiriladi; so'rov/hodisalar yig'iladi. */
export function staffRefKey(linkHref: string | null | undefined): string | null {
  const m = /^\/(orders|payments|tasks)\/(\d+)(?:[/?#]|$)/.exec(String(linkHref ?? ""));
  return m ? `n:${m[1]}:${m[2]}` : null;
}

type Target = { telegramId: bigint; chatId: bigint; lang: Lang; prefs: ReturnType<typeof readPrefs> };

async function chatTargets(tenantId: number, telegramIds: bigint[]): Promise<Target[]> {
  if (telegramIds.length === 0) return [];
  const chats = await prisma.tgChat.findMany({
    where: { tenant_id: tenantId, telegram_id: { in: telegramIds }, OR: [{ blocked_until: null }, { blocked_until: { lt: new Date() } }] },
    select: { telegram_id: true, chat_id: true, lang: true, notify_prefs: true }
  });
  return chats.map((c) => ({ telegramId: c.telegram_id, chatId: c.chat_id, lang: normLang(c.lang), prefs: readPrefs(c.notify_prefs) }));
}

/**
 * Bitta chatga xabar. `refKey` berilsa — shu mavzudagi eski xabar o'chirilib,
 * yangisi yuboriladi (chatda bitta dolzarb xabar qoladi).
 */
async function deliver(t: Target, type: NotifyType, text: string, refKey: string | null, markup?: TgInlineKeyboard): Promise<void> {
  if (t.prefs.off?.includes(type)) return;
  try {
    const sent = await tgCall<TgMessage>("sendMessage", {
      chat_id: Number(t.chatId),
      text: clip(text),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      disable_notification: isQuietNow(t.prefs.quiet === true),
      ...(markup ? { reply_markup: markup } : {})
    });
    if (!refKey) return;
    const key = refKey.slice(0, 64);
    const prev = await prisma.tgNotifyMessage.findUnique({ where: { telegram_id_ref_key: { telegram_id: t.telegramId, ref_key: key } } });
    if (prev && Date.now() - prev.sent_at.getTime() < DELETE_WINDOW_MS) await tgDelete(t.chatId, prev.message_id);
    await prisma.tgNotifyMessage.upsert({
      where: { telegram_id_ref_key: { telegram_id: t.telegramId, ref_key: key } },
      create: { telegram_id: t.telegramId, ref_key: key, message_id: sent.message_id },
      update: { message_id: sent.message_id, sent_at: new Date() }
    });
  } catch (e) {
    if (e instanceof TgApiError && e.code === 403) {
      await prisma.tgChat
        .update({ where: { telegram_id: t.telegramId }, data: { blocked_until: new Date(Date.now() + 7 * 86400_000) } })
        .catch(() => undefined);
      return;
    }
    logger.debug({ err: e }, "tg-app deliver failed");
  }
}

const menuKb = (lang: Lang, extra?: ReturnType<typeof btn>) =>
  kb(extra ? [extra] : null, [btn(lang === "ru" ? "🏠 Меню" : "🏠 Menyu", cb("m", "home"))]);

/** `createNotification` dan keyin: xodim Telegramiga nusxa (faqat yangi botni ochgan bo'lsa). */
export async function pushStaffNotification(input: {
  tenant_id: number;
  user_id: number;
  title: string;
  body?: string | null;
  link_href?: string | null;
}): Promise<void> {
  if (!tgEnabled()) return;
  const tenant = await resolveBotTenant();
  if (!tenant || tenant.id !== input.tenant_id) return;
  const link = await prisma.telegramStaffLink.findUnique({ where: { user_id: input.user_id }, select: { telegram_id: true, tenant_id: true } });
  if (!link || link.tenant_id !== input.tenant_id) return;
  const [target] = await chatTargets(input.tenant_id, [link.telegram_id]);
  if (!target) return;
  const type = classifyNotification(input.link_href, input.title);
  const icon: Record<NotifyType, string> = {
    order: "📦",
    payment: "💳",
    consignment: "🧾",
    reminder: "⏰",
    bonus: "🎁",
    payroll: "💵",
    task: "✅",
    other: "🔔"
  };
  const text = `${icon[type]} <b>${esc(input.title)}</b>${input.body ? `\n${esc(input.body)}` : ""}`;
  const ref = staffRefKey(input.link_href);
  await deliver(target, type, text, ref, menuKb(target.lang));
}

export function pushStaffNotificationSoon(input: Parameters<typeof pushStaffNotification>[0]): void {
  if (!tgEnabled()) return;
  setImmediate(() => {
    pushStaffNotification(input).catch((e) => logger.debug({ err: e }, "tg-app staff push failed"));
  });
}

async function clientTargets(tenantId: number, clientId: number): Promise<Target[]> {
  const links = await prisma.tgClientLink.findMany({
    where: { tenant_id: tenantId, client_id: clientId, status: "active" },
    select: { telegram_id: true }
  });
  return chatTargets(tenantId, links.map((l) => l.telegram_id));
}

const STATUS_TEXT: Record<string, [string, string]> = {
  confirmed: ["✅ Buyurtmangiz tasdiqlandi", "✅ Ваш заказ подтверждён"],
  picking: ["📦 Buyurtmangiz yig‘ilmoqda", "📦 Ваш заказ собирается"],
  delivering: ["🚚 Buyurtmangiz yo‘lda", "🚚 Ваш заказ в пути"],
  delivered: ["✔️ Buyurtmangiz yetkazildi", "✔️ Ваш заказ доставлен"],
  cancelled: ["❌ Buyurtmangiz bekor qilindi", "❌ Ваш заказ отменён"],
  returned: ["↩️ Buyurtma qaytarildi", "↩️ Заказ возвращён"]
};

export async function notifyClientOrderStatus(tenantId: number, orderId: number, toStatus: string): Promise<void> {
  if (!tgEnabled() || !STATUS_TEXT[toStatus]) return;
  const o = await prisma.order.findFirst({
    where: { id: orderId, tenant_id: tenantId, order_type: "order" },
    select: { id: true, client_id: true, number: true, total_sum: true }
  });
  if (!o) return;
  for (const t of await clientTargets(tenantId, o.client_id)) {
    const [uz, ru] = STATUS_TEXT[toStatus];
    const text = `<b>${t.lang === "ru" ? ru : uz}</b>\n🧾 №${esc(o.number)} · ${money(o.total_sum)}`;
    const open = btn(t.lang === "ru" ? "🔎 Открыть" : "🔎 Ochish", cb("c", "o", o.id, 1), "primary");
    await deliver(t, "order", text, `o:${o.id}`, menuKb(t.lang, open));
  }
}

export async function notifyClientPayment(tenantId: number, clientId: number, amount: unknown, paymentId: number): Promise<void> {
  if (!tgEnabled()) return;
  for (const t of await clientTargets(tenantId, clientId)) {
    const text =
      t.lang === "ru"
        ? `💳 <b>Оплата принята</b>\nСумма: <b>${money(amount)}</b>`
        : `💳 <b>To‘lov qabul qilindi</b>\nSumma: <b>${money(amount)}</b>`;
    const bal = btn(t.lang === "ru" ? "💰 Баланс" : "💰 Balans", cb("c", "bal"), "primary");
    await deliver(t, "payment", text, `p:${paymentId}`, menuKb(t.lang, bal));
  }
}

export async function notifyClientRaw(tenantId: number, clientId: number, type: NotifyType, text: { uz: string; ru: string }, refKey: string | null): Promise<void> {
  if (!tgEnabled()) return;
  for (const t of await clientTargets(tenantId, clientId)) {
    await deliver(t, type, t.lang === "ru" ? text.ru : text.uz, refKey, menuKb(t.lang));
  }
}

export async function notifyTelegramRaw(tenantId: number, telegramId: bigint, type: NotifyType, text: { uz: string; ru: string }): Promise<void> {
  if (!tgEnabled()) return;
  const [target] = await chatTargets(tenantId, [telegramId]);
  if (target) await deliver(target, type, target.lang === "ru" ? text.ru : text.uz, null, menuKb(target.lang));
}

/** Faqat Telegramga (web bildirishnomasiz) — kundalik eslatmalar uchun. */
export async function notifyStaffTelegram(tenantId: number, userId: number, type: NotifyType, text: { uz: string; ru: string }, refKey: string | null): Promise<void> {
  if (!tgEnabled()) return;
  const link = await prisma.telegramStaffLink.findUnique({ where: { user_id: userId }, select: { telegram_id: true, tenant_id: true } });
  if (!link || link.tenant_id !== tenantId) return;
  const [target] = await chatTargets(tenantId, [link.telegram_id]);
  if (target) await deliver(target, type, target.lang === "ru" ? text.ru : text.uz, refKey, menuKb(target.lang));
}

export function soon(fn: () => Promise<void>): void {
  if (!tgEnabled()) return;
  setImmediate(() => {
    fn().catch((e) => logger.debug({ err: e }, "tg-app async notify failed"));
  });
}
