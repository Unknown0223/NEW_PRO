import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { decideTelegramBind, normSmartCode } from "../telegram-bot/telegram-bot.bind";
import { logAttempt } from "./tg-identity";
import { blockedMinutes } from "./tg-link-client";
import { clearState, dropIncoming, flash, setState, show, type ChatCtx } from "./tg-screen";
import { t } from "./tg-text";
import { btn, cb, esc, kb } from "./tg-ui.pure";

/** Parol tekshiruvidan keyin smart-kod kiritish uchun beriladigan vaqt. */
const SMART_STEP_TTL_MS = 5 * 60_000;

/** Login topilmaganda ham bcrypt ishlaydi — javob vaqti orqali loginni aniqlab bo'lmaydi. */
let dummyHash: string | undefined;

const cancelKb = (ctx: ChatCtx) => kb([btn(t(ctx.lang, "cancel"), cb("m", "home"), "danger")]);

async function fail(ctx: ChatCtx, reason: string, userId?: number) {
  await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind: "staff_login", ok: false, reason, userId });
}

async function guardBlocked(ctx: ChatCtx): Promise<boolean> {
  const mins = await blockedMinutes(ctx);
  if (mins === 0) return false;
  await clearState(ctx);
  await show(ctx, { text: t(ctx.lang, "blocked", { min: mins }), kb: cancelKb(ctx) }, { fresh: true });
  return true;
}

export async function askStaffLogin(ctx: ChatCtx): Promise<void> {
  if (await guardBlocked(ctx)) return;
  const clientLinks = await prisma.tgClientLink.count({
    where: { telegram_id: ctx.telegramId, status: { in: ["active", "pending"] } }
  });
  if (clientLinks > 0) {
    await show(ctx, { text: t(ctx.lang, "clientCantBeStaff"), kb: kb([btn(t(ctx.lang, "back"), cb("m", "home"))]) });
    return;
  }
  await setState(ctx, { step: "staff_login" });
  await show(ctx, { text: t(ctx.lang, "askLogin"), kb: cancelKb(ctx) });
}

export async function onStaffLogin(ctx: ChatCtx, text: string, incomingId: number): Promise<void> {
  await dropIncoming(ctx, incomingId);
  const login = text.trim().slice(0, 64);
  if (!login) return;
  await setState(ctx, { step: "staff_password", data: { login } });
  await show(ctx, { text: t(ctx.lang, "askPassword"), kb: cancelKb(ctx) }, { fresh: true });
}

async function bind(ctx: ChatCtx, userId: number, name: string): Promise<void> {
  const [byTelegram, byUser] = await Promise.all([
    prisma.telegramStaffLink.findUnique({ where: { telegram_id: ctx.telegramId }, select: { user_id: true } }),
    prisma.telegramStaffLink.findUnique({ where: { user_id: userId }, select: { telegram_id: true } })
  ]);
  const decision = decideTelegramBind({
    telegramId: ctx.telegramId.toString(),
    staffUserId: userId,
    byTelegramUserId: byTelegram?.user_id ?? null,
    boundTelegramId: byUser ? byUser.telegram_id.toString() : null
  });
  if (!decision.ok) {
    await fail(ctx, decision.reason, userId);
    await clearState(ctx);
    await show(ctx, { text: t(ctx.lang, "staffBoundOther"), kb: kb([btn(t(ctx.lang, "home"), cb("m", "home"))]) }, { fresh: true });
    return;
  }
  if (!decision.alreadyBound) {
    try {
      await prisma.telegramStaffLink.create({ data: { tenant_id: ctx.tenantId, user_id: userId, telegram_id: ctx.telegramId } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        await fail(ctx, "bind_race", userId);
        await clearState(ctx);
        await show(ctx, { text: t(ctx.lang, "staffBoundOther"), kb: kb([btn(t(ctx.lang, "home"), cb("m", "home"))]) }, { fresh: true });
        return;
      }
      throw e;
    }
  }
  await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind: "staff_login", ok: true, userId });
  await clearState(ctx);
  await flash(ctx, "🎉", 5);
  await flash(ctx, t(ctx.lang, "staffOk", { name: esc(name) }), 6);
}

export async function onStaffPassword(ctx: ChatCtx, password: string, incomingId: number): Promise<void> {
  await dropIncoming(ctx, incomingId);
  if (await guardBlocked(ctx)) return;
  const login = String(ctx.state.data?.login ?? "");
  const user = await prisma.user.findFirst({
    where: { tenant_id: ctx.tenantId, login: { equals: login, mode: "insensitive" } },
    select: { id: true, name: true, password_hash: true, is_active: true }
  });
  dummyHash ??= bcrypt.hashSync("tg-app-dummy", 10);
  const ok = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
  if (!user || !ok || !user.is_active) {
    await fail(ctx, !user ? "not_found" : !ok ? "bad_password" : "inactive", user?.id);
    await setState(ctx, { step: "staff_login" });
    await show(ctx, { text: `${t(ctx.lang, "loginBad")}\n\n${t(ctx.lang, "askLogin")}`, kb: cancelKb(ctx) }, { fresh: true });
    return;
  }
  const slots = await prisma.workSlot.count({
    where: { tenant_id: ctx.tenantId, deleted_at: null, user_links: { some: { user_id: user.id, ended_at: null } } }
  });
  if (slots === 0) {
    await bind(ctx, user.id, user.name);
    return;
  }
  await setState(ctx, { step: "staff_smart", data: { userId: user.id, until: Date.now() + SMART_STEP_TTL_MS } });
  await show(ctx, { text: t(ctx.lang, "askSmart"), kb: cancelKb(ctx) }, { fresh: true });
}

export async function onStaffSmart(ctx: ChatCtx, text: string, incomingId: number): Promise<void> {
  await dropIncoming(ctx, incomingId);
  if (await guardBlocked(ctx)) return;
  const userId = Number(ctx.state.data?.userId);
  const until = Number(ctx.state.data?.until ?? 0);
  if (!userId || Date.now() > until) {
    await setState(ctx, { step: "staff_login" });
    await show(ctx, { text: t(ctx.lang, "askLogin"), kb: cancelKb(ctx) }, { fresh: true });
    return;
  }
  const user = await prisma.user.findFirst({
    where: { id: userId, tenant_id: ctx.tenantId, is_active: true },
    select: { id: true, name: true }
  });
  const slots = user
    ? await prisma.workSlot.findMany({
        where: { tenant_id: ctx.tenantId, deleted_at: null, user_links: { some: { user_id: userId, ended_at: null } } },
        select: { slot_code: true }
      })
    : [];
  const want = normSmartCode(text);
  if (!user || !want || !slots.some((s) => normSmartCode(s.slot_code) === want)) {
    await fail(ctx, "bad_smart", userId);
    await show(ctx, { text: `${t(ctx.lang, "smartBad")}\n\n${t(ctx.lang, "askSmart")}`, kb: cancelKb(ctx) }, { fresh: true });
    return;
  }
  await bind(ctx, user.id, user.name);
}

export async function staffLogout(ctx: ChatCtx, userId: number): Promise<void> {
  await prisma.telegramStaffLink.deleteMany({ where: { user_id: userId, telegram_id: ctx.telegramId } });
  await logAttempt({ tenantId: ctx.tenantId, telegramId: ctx.telegramId, kind: "staff_logout", ok: true, userId });
  await clearState(ctx);
}
