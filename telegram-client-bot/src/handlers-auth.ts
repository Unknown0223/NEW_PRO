import * as db from "./db.js";
import { apiLookupStaff, apiRegisterStaff } from "./salec-api.js";
import { T } from "./texts.js";
import { EMPTY_SESSION, type BotUser, type SessionData } from "./types.js";
import { showMenu } from "./flow.js";
import type { Ctx } from "./ctx.js";
import { HTML } from "./ui.js";

export type BotApiCfg = { apiUrl: string; apiSecret: string; tenantSlug: string };

export async function handleStart(
  ctx: Ctx,
  sess: SessionData,
  databaseUrl: string,
  api: BotApiCfg
) {
  if (!ctx.from) return;
  const looked = await apiLookupStaff(api, ctx.from.id);
  if (looked.ok) {
    const botUser: BotUser = { telegram_id: ctx.from.id, ...looked.user };
    await db.upsertBotUser(databaseUrl, botUser);
    sess.step = "idle";
    await showMenu(ctx, botUser);
    return;
  }
  if (looked.reason === "unbound") {
    await db.deleteBotUser(databaseUrl, ctx.from.id);
    sess.step = "reg_login";
    sess.login = "";
    sess.password = "";
    await ctx.reply(`${T.startGuest}\n\n${T.askLogin}`, HTML);
    return;
  }
  if (looked.reason === "api_down") {
    const cached = await db.getBotUser(databaseUrl, ctx.from.id);
    if (cached) {
      sess.step = "idle";
      await ctx.reply("🟠 Platforma API vaqtincha javob bermadi. Mahalliy sessiya bilan davom.", HTML);
      await showMenu(ctx, cached);
      return;
    }
  }
  await ctx.reply(`🔴 ${looked.message}`, HTML);
}

export async function handleAuthText(
  ctx: Ctx,
  sess: SessionData,
  text: string,
  databaseUrl: string,
  api: BotApiCfg
): Promise<boolean> {
  const t = text.trim();
  if (sess.step === "reg_login") {
    sess.login = t;
    sess.password = "";
    sess.step = "reg_password";
    await ctx.reply(T.askPassword, HTML);
    return true;
  }
  if (sess.step === "reg_password") {
    try {
      await ctx.deleteMessage?.();
    } catch {
      /* ignore */
    }
    sess.password = t;
    sess.step = "reg_smart";
    await ctx.reply(T.askSmart, HTML);
    return true;
  }
  if (sess.step !== "reg_smart") return false;
  if (!ctx.from) return true;

  const auth = await apiRegisterStaff(api, {
    login: sess.login,
    password: sess.password,
    smartCode: t,
    telegramId: ctx.from.id
  });
  if (!auth.ok) {
    console.warn("[client-intake-bot] auth fail", {
      login: sess.login,
      reason: auth.reason
    });
    sess.step = "reg_login";
    sess.password = "";
    const extra = auth.hint ? `\n<code>${auth.hint}</code>` : "";
    await ctx.reply(`🔴 ${auth.message}${extra}\n\n${T.askLogin}`, HTML);
    return true;
  }
  const botUser: BotUser = { telegram_id: ctx.from.id, ...auth.user };
  await db.upsertBotUser(databaseUrl, botUser);
  sess.step = "idle";
  sess.login = "";
  sess.password = "";
  await ctx.reply(
    T.registered(auth.user.display_name ?? auth.user.login, auth.user.role, auth.user.smart_code),
    HTML
  );
  await showMenu(ctx, botUser);
  return true;
}

export async function handleLogout(ctx: Ctx, sess: SessionData, databaseUrl: string) {
  if (ctx.from) await db.deleteBotUser(databaseUrl, ctx.from.id);
  Object.assign(sess, EMPTY_SESSION());
  sess.step = "reg_login";
  await ctx.reply(`${T.loggedOut}\n\n${T.askLogin}`, {
    ...HTML,
    reply_markup: { remove_keyboard: true }
  });
}
