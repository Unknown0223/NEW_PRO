/** Telegram klient-bot: qaysi platforma rollari kirishi mumkin. */

const BOT_DENIED_ROLES = new Set([
  "expeditor",
  "gruzchik",
  "driver",
  "cashier",
  "storekeeper",
  "partner"
]);

/** Agent qo‘shadi; qolgan ruxsat berilgan rollar — faqat yuklab olish (scope bo‘yicha). */
export function isTelegramBotAllowedRole(role: string): boolean {
  const r = role.trim().toLowerCase();
  if (!r) return false;
  if (r === "agent") return true;
  if (BOT_DENIED_ROLES.has(r)) return false;
  return true;
}

export function telegramBotCanAddClients(role: string): boolean {
  return role.trim().toLowerCase() === "agent";
}

export function telegramBotCanDownloadIntake(role: string): boolean {
  return isTelegramBotAllowedRole(role) && !telegramBotCanAddClients(role);
}

/** @deprecated — isTelegramBotAllowedRole / capabilities ishlating */
export function asTelegramBotRole(role: string): "agent" | "supervisor" | null {
  if (!isTelegramBotAllowedRole(role)) return null;
  if (role === "agent") return "agent";
  // Eski DTO: downloader larni supervisor deb belgilash o‘rniga platform role saqlanadi;
  // bu funksiya faqat backward-compat testlar uchun agent|supervisor qaytaradi.
  if (role === "supervisor") return "supervisor";
  return role === "agent" ? "agent" : "supervisor";
}

export type TelegramBindDecision =
  | { ok: true; alreadyBound: boolean }
  | { ok: false; reason: "telegram_taken" | "staff_bound_other_telegram" };

/**
 * Bir Telegram ID — bitta hodim; bir hodim — bitta Telegram.
 * Allaqachon shu juftlik bo‘lsa — qayta kirish (alreadyBound).
 */
export function decideTelegramBind(input: {
  telegramId: string;
  staffUserId: number;
  byTelegramUserId: number | null;
  boundTelegramId: string | null;
}): TelegramBindDecision {
  const tg = input.telegramId.trim();
  if (input.byTelegramUserId != null && input.byTelegramUserId !== input.staffUserId) {
    return { ok: false, reason: "telegram_taken" };
  }
  if (input.boundTelegramId && input.boundTelegramId !== tg) {
    return { ok: false, reason: "staff_bound_other_telegram" };
  }
  if (input.boundTelegramId === tg && input.byTelegramUserId === input.staffUserId) {
    return { ok: true, alreadyBound: true };
  }
  return { ok: true, alreadyBound: false };
}

export function normSmartCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-]+/g, "");
}
