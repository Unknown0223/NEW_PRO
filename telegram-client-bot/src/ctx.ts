import type { InputFile } from "grammy";

export type Ctx = {
  from?: { id: number };
  chat?: { id: number };
  reply: (text: string, extra?: object) => Promise<unknown>;
  replyWithDocument?: (file: InputFile, extra?: object) => Promise<unknown>;
  deleteMessage?: () => Promise<unknown>;
  message?: { text?: string; location?: { latitude: number; longitude: number } };
  callbackQuery?: { data?: string };
  answerCallbackQuery?: (opts?: object) => Promise<unknown>;
  api?: {
    editMessageText: (
      chatId: number,
      messageId: number,
      text: string,
      extra?: object
    ) => Promise<unknown>;
    deleteMessage: (chatId: number, messageId: number) => Promise<unknown>;
  };
};
