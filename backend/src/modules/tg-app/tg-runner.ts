import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { tgCall, tgEnabled, type TgUpdate } from "./tg-api";
import { runConsignmentReminders } from "./tg-reminders";
import { handleUpdate } from "./tg-router";
import { sweepJunk } from "./tg-screen";
import { localHour, todayYmd } from "./tg-ui.pure";

const ALLOWED_UPDATES = ["message", "callback_query"];
const REMINDER_HOUR = 10;

let running = false;
let sweepTimer: NodeJS.Timeout | null = null;
let reminderTimer: NodeJS.Timeout | null = null;
let lastReminderDay = "";

export function tgWebhookUrl(): string | null {
  if (!env.TG_APP_PUBLIC_URL) return null;
  return `${env.TG_APP_PUBLIC_URL.replace(/\/+$/, "")}/api/tg-app/webhook`;
}

async function pollLoop(): Promise<void> {
  let offset = 0;
  await tgCall("deleteWebhook", { drop_pending_updates: false }).catch(() => undefined);
  while (running) {
    try {
      const updates = await tgCall<TgUpdate[]>("getUpdates", { offset, timeout: 25, allowed_updates: ALLOWED_UPDATES }, 35_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        void handleUpdate(u);
      }
    } catch (e) {
      if (!running) break;
      logger.warn({ err: e }, "tg-app polling error");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

async function reminderTick(): Promise<void> {
  const day = todayYmd();
  if (localHour() !== REMINDER_HOUR || lastReminderDay === day) return;
  lastReminderDay = day;
  const r = await runConsignmentReminders();
  logger.info(r, "tg-app consignment reminders sent");
}

export async function startTgApp(): Promise<void> {
  if (!tgEnabled() || running) return;
  running = true;
  try {
    const me = await tgCall<{ username?: string }>("getMe");
    logger.info({ bot: me.username, mode: env.TG_APP_MODE }, "tg-app bot started");
  } catch (e) {
    running = false;
    logger.error({ err: e }, "tg-app getMe failed — bot disabled");
    return;
  }
  if (env.TG_APP_MODE === "webhook") {
    const url = tgWebhookUrl();
    if (!url || !env.TG_APP_WEBHOOK_SECRET) {
      logger.error("tg-app webhook mode needs TG_APP_PUBLIC_URL and TG_APP_WEBHOOK_SECRET");
    } else {
      await tgCall("setWebhook", { url, secret_token: env.TG_APP_WEBHOOK_SECRET, allowed_updates: ALLOWED_UPDATES, max_connections: 20 }).catch((e) =>
        logger.error({ err: e }, "tg-app setWebhook failed")
      );
    }
  } else {
    void pollLoop();
  }
  sweepTimer = setInterval(() => void sweepJunk().catch(() => undefined), 5000);
  reminderTimer = setInterval(() => void reminderTick().catch((e) => logger.warn({ err: e }, "tg-app reminders failed")), 10 * 60_000);
}

export function stopTgApp(): void {
  running = false;
  if (sweepTimer) clearInterval(sweepTimer);
  if (reminderTimer) clearInterval(reminderTimer);
  sweepTimer = null;
  reminderTimer = null;
}

/** Webhook orqali kelgan yangilanish. */
export function acceptWebhookUpdate(u: TgUpdate): void {
  if (!running) return;
  void handleUpdate(u);
}

export const tgAppBotUsername = async (): Promise<string | null> => {
  try {
    const me = await tgCall<{ username?: string }>("getMe");
    return me.username ?? null;
  } catch {
    return null;
  }
};
