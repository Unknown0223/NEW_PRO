import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { Identity } from "./tg-identity";
import { logAttempt } from "./tg-identity";
import { staffLogout } from "./tg-link-staff";
import { NOTIFY_TYPES, readPrefs } from "./tg-prefs.pure";
import { patchChat, type ChatCtx, type View } from "./tg-screen";
import { L, t } from "./tg-text";
import { btn, cb, kb } from "./tg-ui.pure";

const TYPE_LABEL: Record<string, [string, string]> = {
  order: ["📦 Buyurtmalar", "📦 Заказы"],
  payment: ["💳 To‘lovlar", "💳 Оплаты"],
  consignment: ["🧾 Konsignatsiya", "🧾 Консигнация"],
  reminder: ["⏰ Eslatmalar", "⏰ Напоминания"],
  bonus: ["🎁 Bonuslar", "🎁 Бонусы"],
  payroll: ["💵 Oylik / avans", "💵 Зарплата / аванс"],
  task: ["✅ Vazifalar", "✅ Задачи"],
  other: ["🔔 Boshqa", "🔔 Прочее"]
};

export function settingsView(ctx: ChatCtx, id: Identity): View {
  const lang = ctx.lang;
  const prefs = readPrefs(ctx.row.notify_prefs);
  const isStaff = id.kind === "staff";
  return {
    text: `⚙️ <b>${L(lang, "Sozlamalar", "Настройки")}</b>`,
    kb: kb(
      [btn(t(lang, "language"), cb("x", "lang"))],
      [btn(t(lang, "notifications"), cb("x", "nt"))],
      [btn(t(lang, "quietHours", { state: t(lang, prefs.quiet ? "on" : "off") }), cb("x", "quiet"))],
      [btn(t(lang, isStaff ? "logout" : "unlink"), cb("x", "unlink"), "danger")],
      [btn(t(lang, "home"), cb("m", "home"))]
    )
  };
}

export function notifyView(ctx: ChatCtx, id: Identity): View {
  const lang = ctx.lang;
  const prefs = readPrefs(ctx.row.notify_prefs);
  const types = id.kind === "staff" ? NOTIFY_TYPES.staff : NOTIFY_TYPES.client;
  return {
    text: `🔔 <b>${L(lang, "Bildirishnomalar", "Уведомления")}</b>\n${L(lang, "Bosib yoqing yoki o‘chiring:", "Нажмите, чтобы включить или выключить:")}`,
    kb: kb(
      ...types.map((tp) => {
        const off = prefs.off?.includes(tp);
        const label = TYPE_LABEL[tp] ?? [tp, tp];
        return [btn(`${off ? "🔕" : "✅"} ${lang === "ru" ? label[1] : label[0]}`, cb("x", "nt", tp), off ? undefined : "success")];
      }),
      [btn(t(lang, "back"), cb("x", "set"))]
    )
  };
}

export async function toggleNotifyType(ctx: ChatCtx, type: string): Promise<void> {
  const allowed: readonly string[] = [...NOTIFY_TYPES.staff, ...NOTIFY_TYPES.client];
  if (!allowed.includes(type)) return;
  const prefs = readPrefs(ctx.row.notify_prefs);
  const off = new Set(prefs.off);
  if (off.has(type)) off.delete(type);
  else off.add(type);
  await patchChat(ctx, { notify_prefs: { ...prefs, off: [...off] } as Prisma.InputJsonValue });
}

export async function toggleQuiet(ctx: ChatCtx): Promise<void> {
  const prefs = readPrefs(ctx.row.notify_prefs);
  await patchChat(ctx, { notify_prefs: { ...prefs, quiet: !prefs.quiet } as Prisma.InputJsonValue });
}

export async function toggleLang(ctx: ChatCtx): Promise<void> {
  await patchChat(ctx, { lang: ctx.lang === "uz" ? "ru" : "uz" });
}

export function unlinkConfirmView(ctx: ChatCtx): View {
  return {
    text: t(ctx.lang, "unlinkConfirm"),
    kb: kb([btn(t(ctx.lang, "yes"), cb("x", "unlink", "y"), "danger"), btn(t(ctx.lang, "no"), cb("x", "set"))])
  };
}

export async function doUnlink(ctx: ChatCtx, id: Identity): Promise<void> {
  if (id.kind === "staff") {
    await staffLogout(ctx, id.user.id);
  } else {
    await prisma.tgClientLink.updateMany({
      where: { telegram_id: ctx.telegramId, status: { in: ["active", "pending"] } },
      data: { status: "revoked", revoked_at: new Date(), revoke_reason: "self_unlink" }
    });
    await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind: "client_unlink", ok: true });
  }
  await patchChat(ctx, { active_client_id: null, state: {} });
}
