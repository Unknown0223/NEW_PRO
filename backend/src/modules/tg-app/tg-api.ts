import { env } from "../../config/env";
import { logger } from "../../config/logger";

/** Bot API 9.4: tugma rangi. */
export type TgButtonStyle = "primary" | "success" | "danger";

export type TgInlineButton = {
  text: string;
  callback_data?: string;
  url?: string;
  style?: TgButtonStyle;
  icon_custom_emoji_id?: string;
};

export type TgInlineKeyboard = { inline_keyboard: TgInlineButton[][] };

export type TgReplyKeyboard = {
  keyboard: Array<Array<{ text: string; request_contact?: boolean; style?: TgButtonStyle }>>;
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
};

export type TgReplyMarkup = TgInlineKeyboard | TgReplyKeyboard | { remove_keyboard: true };

export type TgUser = { id: number; is_bot?: boolean; first_name?: string; username?: string; language_code?: string };
export type TgChatRef = { id: number; type: string };
export type TgContact = { phone_number: string; user_id?: number; first_name?: string };

export type TgMessage = {
  message_id: number;
  from?: TgUser;
  chat: TgChatRef;
  date: number;
  text?: string;
  contact?: TgContact;
};

export type TgCallbackQuery = { id: string; from: TgUser; message?: TgMessage; data?: string };

export type TgUpdate = { update_id: number; message?: TgMessage; callback_query?: TgCallbackQuery };

export class TgApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly description: string
  ) {
    super(message);
  }
}

const base = () => `https://api.telegram.org/bot${env.TG_APP_BOT_TOKEN}`;

export function tgEnabled(): boolean {
  return Boolean(env.TG_APP_BOT_TOKEN && env.TG_APP_TENANT_SLUG && env.TG_APP_MODE !== "off");
}

async function parse<T>(method: string, res: Response): Promise<T> {
  const body = (await res.json().catch(() => null)) as
    | { ok: boolean; result?: T; error_code?: number; description?: string; parameters?: { retry_after?: number } }
    | null;
  if (body?.ok) return body.result as T;
  const code = body?.error_code ?? res.status;
  const desc = body?.description ?? res.statusText;
  const err = new TgApiError(`telegram ${method}: ${code} ${desc}`, code, desc);
  (err as TgApiError & { retryAfter?: number }).retryAfter = body?.parameters?.retry_after;
  throw err;
}

export async function tgCall<T = unknown>(method: string, payload: Record<string, unknown> = {}, timeoutMs = 15000): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${base()}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs)
      });
      return await parse<T>(method, res);
    } catch (e) {
      const retryAfter = (e as { retryAfter?: number }).retryAfter;
      if (e instanceof TgApiError && e.code === 429 && retryAfter && attempt < 2) {
        await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
        continue;
      }
      throw e;
    }
  }
}

/** «message is not modified» / «message to delete not found» — xato emas. */
export function isHarmlessTgError(e: unknown): boolean {
  if (!(e instanceof TgApiError)) return false;
  const d = e.description.toLowerCase();
  return d.includes("message is not modified") || d.includes("message to delete not found") || d.includes("message can't be deleted");
}

export async function tgSend(chatId: number | bigint, text: string, markup?: TgReplyMarkup): Promise<TgMessage> {
  return tgCall<TgMessage>("sendMessage", {
    chat_id: Number(chatId),
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(markup ? { reply_markup: markup } : {})
  });
}

export async function tgEdit(chatId: number | bigint, messageId: number, text: string, markup?: TgInlineKeyboard): Promise<void> {
  await tgCall("editMessageText", {
    chat_id: Number(chatId),
    message_id: messageId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: markup ?? { inline_keyboard: [] }
  });
}

export async function tgDelete(chatId: number | bigint, messageId: number): Promise<void> {
  try {
    await tgCall("deleteMessage", { chat_id: Number(chatId), message_id: messageId });
  } catch (e) {
    if (!isHarmlessTgError(e)) logger.debug({ err: e }, "tg delete failed");
  }
}

export async function tgAnswerCallback(id: string, text?: string, alert = false): Promise<void> {
  try {
    await tgCall("answerCallbackQuery", { callback_query_id: id, ...(text ? { text, show_alert: alert } : {}) });
  } catch (e) {
    logger.debug({ err: e }, "tg answerCallback failed");
  }
}

export async function tgChatAction(chatId: number | bigint, action: "typing" | "upload_document"): Promise<void> {
  await tgCall("sendChatAction", { chat_id: Number(chatId), action }).catch(() => undefined);
}

export async function tgSendDocument(
  chatId: number | bigint,
  file: Buffer,
  filename: string,
  caption?: string,
  markup?: TgInlineKeyboard
): Promise<TgMessage> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("document", new Blob([new Uint8Array(file)]), filename);
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }
  if (markup) form.append("reply_markup", JSON.stringify(markup));
  const res = await fetch(`${base()}/sendDocument`, { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
  return parse<TgMessage>("sendDocument", res);
}
