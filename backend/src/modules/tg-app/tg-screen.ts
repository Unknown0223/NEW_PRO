import type { Prisma, TgChat } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { TgApiError, isHarmlessTgError, tgDelete, tgEdit, tgSend, type TgInlineKeyboard, type TgReplyMarkup } from "./tg-api";
import { normLang, type Lang } from "./tg-text";
import { clip } from "./tg-ui.pure";

export type ChatState = { step?: string; data?: Record<string, unknown> };
export type JunkItem = { id: number; at: number };
export type View = { text: string; kb?: TgInlineKeyboard };

export type ChatCtx = {
  telegramId: bigint;
  chatId: bigint;
  tenantId: number;
  row: TgChat;
  lang: Lang;
  state: ChatState;
  /** Callback kelgan xabar id si (tahrirlash uchun). */
  cbMessageId?: number;
};

/** Telegram botga 48 soatdan eski xabarlarni o'chirishga ruxsat bermaydi. */
const DELETE_WINDOW_MS = 47 * 3600 * 1000;

export async function loadChat(tenantId: number, telegramId: bigint, chatId: bigint): Promise<ChatCtx> {
  const row = await prisma.tgChat.upsert({
    where: { telegram_id: telegramId },
    create: { telegram_id: telegramId, tenant_id: tenantId, chat_id: chatId },
    update: { chat_id: chatId }
  });
  return {
    telegramId,
    chatId,
    tenantId,
    row,
    lang: normLang(row.lang),
    state: (row.state ?? {}) as ChatState
  };
}

export async function setState(ctx: ChatCtx, state: ChatState): Promise<void> {
  ctx.state = state;
  await prisma.tgChat.update({ where: { telegram_id: ctx.telegramId }, data: { state: state as Prisma.InputJsonValue } });
}

export async function clearState(ctx: ChatCtx): Promise<void> {
  if (!ctx.state.step && !ctx.state.data) return;
  await setState(ctx, {});
}

export async function patchChat(ctx: ChatCtx, data: Prisma.TgChatUpdateInput): Promise<void> {
  ctx.row = await prisma.tgChat.update({ where: { telegram_id: ctx.telegramId }, data });
  ctx.lang = normLang(ctx.row.lang);
}

async function saveScreenId(ctx: ChatCtx, messageId: number | null): Promise<void> {
  ctx.row.screen_message_id = messageId;
  await prisma.tgChat.update({ where: { telegram_id: ctx.telegramId }, data: { screen_message_id: messageId } });
}

/**
 * Ekranni ko'rsatish. `fresh` — eski ekranni o'chirib, pastga yangisini yuborish
 * (foydalanuvchi matn yozganda); aks holda joyida tahrirlash.
 */
export async function show(ctx: ChatCtx, view: View, opts: { fresh?: boolean } = {}): Promise<void> {
  const text = clip(view.text);
  const current = ctx.cbMessageId ?? ctx.row.screen_message_id ?? null;
  if (current && !opts.fresh) {
    try {
      await tgEdit(ctx.chatId, current, text, view.kb);
      if (current !== ctx.row.screen_message_id) {
        const old = ctx.row.screen_message_id;
        await saveScreenId(ctx, current);
        if (old) await tgDelete(ctx.chatId, old);
      }
      return;
    } catch (e) {
      if (isHarmlessTgError(e)) return;
      if (!(e instanceof TgApiError)) throw e;
      logger.debug({ err: e }, "tg edit failed, sending fresh screen");
    }
  }
  const old = ctx.row.screen_message_id;
  const sent = await tgSend(ctx.chatId, text, view.kb);
  await saveScreenId(ctx, sent.message_id);
  if (old && old !== sent.message_id) await tgDelete(ctx.chatId, old);
  if (ctx.cbMessageId && ctx.cbMessageId !== old && ctx.cbMessageId !== sent.message_id) {
    await tgDelete(ctx.chatId, ctx.cbMessageId);
  }
  ctx.cbMessageId = undefined;
}

/** Vaqtinchalik xabar (ogohlantirish, animatsion emoji) — `ttlSec` dan keyin o'chiriladi. */
export async function flash(ctx: ChatCtx, text: string, ttlSec = 8, markup?: TgReplyMarkup): Promise<number | null> {
  try {
    const sent = await tgSend(ctx.chatId, text, markup);
    await addJunk(ctx, sent.message_id, ttlSec);
    return sent.message_id;
  } catch (e) {
    logger.debug({ err: e }, "tg flash failed");
    return null;
  }
}

export async function addJunk(ctx: ChatCtx, messageId: number, ttlSec: number): Promise<void> {
  const junk = ((ctx.row.junk ?? []) as JunkItem[]).filter((j) => Date.now() - j.at < DELETE_WINDOW_MS);
  junk.push({ id: messageId, at: Date.now() + ttlSec * 1000 });
  ctx.row.junk = junk as unknown as Prisma.JsonValue;
  await prisma.tgChat.update({ where: { telegram_id: ctx.telegramId }, data: { junk: junk as Prisma.InputJsonValue } });
}

/** Foydalanuvchi yuborgan matnni (parol, kod) darhol o'chirish. */
export async function dropIncoming(ctx: ChatCtx, messageId: number): Promise<void> {
  await tgDelete(ctx.chatId, messageId);
}

/** Muddati kelgan vaqtinchalik xabarlarni o'chirish (runner har ~5 soniyada chaqiradi). */
export async function sweepJunk(now = Date.now()): Promise<number> {
  const rows = await prisma.tgChat.findMany({
    where: { NOT: { junk: { equals: [] } } },
    select: { telegram_id: true, chat_id: true, junk: true },
    take: 200
  });
  let deleted = 0;
  for (const r of rows) {
    const junk = (r.junk ?? []) as JunkItem[];
    const due = junk.filter((j) => j.at <= now);
    if (due.length === 0) continue;
    for (const j of due) {
      await tgDelete(r.chat_id, j.id);
      deleted++;
    }
    const keep = junk.filter((j) => j.at > now && now - j.at < DELETE_WINDOW_MS);
    await prisma.tgChat.update({ where: { telegram_id: r.telegram_id }, data: { junk: keep as Prisma.InputJsonValue } });
  }
  return deleted;
}
