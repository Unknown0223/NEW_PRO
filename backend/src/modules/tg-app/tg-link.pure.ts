import { createHash, randomInt } from "node:crypto";

/** O/0, I/1/L kabi chalkash belgilarsiz alifbo. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LEN = 8;

export const LIMITS = {
  /** Bir mijozga ulanadigan Telegram akkauntlar soni. */
  maxTelegramPerClient: 3,
  /** Bitta Telegram ulanadigan mijozlar soni (tarmoq do'konlari egasi). */
  maxClientsPerTelegram: 5,
  /** Bitta kod bo'yicha nakladnoy raqami urinishlari. */
  maxCodeAttempts: 5,
  /** Soatiga muvaffaqiyatsiz urinishlar (Telegram bo'yicha) — keyin blok. */
  maxFailsPerHour: 5,
  blockMinutes: 60,
  /** Nakladnoy necha kun ichidagi bo'lishi kerak. */
  orderLookbackDays: 90,
  manualCodeTtlHours: 24,
  invoiceCodeTtlHours: 24 * 7
} as const;

export function generateLinkCode(): string {
  let s = "";
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Foydalanuvchi kiritgan kodni normallashtirish; noto'g'ri bo'lsa `null`. */
export function normLinkCode(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .toUpperCase()
    .replace(/^C_/, "")
    .replace(/[\s\-_]+/g, "");
  if (s.length !== CODE_LEN) return null;
  for (const ch of s) if (!CODE_ALPHABET.includes(ch)) return null;
  return s;
}

export function formatLinkCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function hashLinkCode(tenantId: number, code: string): string {
  return createHash("sha256").update(`tg-link:${tenantId}:${code}`).digest("hex");
}

function compact(s: string): string {
  return s.toUpperCase().replace(/[\s\-_#№/]+/g, "");
}

function digits(s: string): string {
  return s.replace(/\D/g, "").replace(/^0+/, "");
}

/**
 * Nakladnoy raqamini solishtirish: to'liq mos yoki raqamli qismi mos
 * (oldingi nollar va prefiks hisobga olinmaydi, kamida 3 raqam).
 */
export function orderNumberMatches(input: string, orderNumber: string): boolean {
  const a = compact(input);
  const b = compact(orderNumber);
  if (!a || !b) return false;
  if (a === b) return true;
  const da = digits(a);
  const db = digits(b);
  return da.length >= 3 && da === db;
}

export type ClientLinkRefusal =
  | "staff_telegram"
  | "too_many_for_client"
  | "too_many_for_telegram"
  | "code_used"
  | "code_expired"
  | "code_attempts"
  | "client_inactive";

export function decideClientLinkStart(input: {
  telegramIsStaff: boolean;
  code: { used_at: Date | null; expires_at: Date; attempts: number } | null;
  clientActive: boolean;
  activeLinksForClient: number;
  activeLinksForTelegram: number;
  alreadyLinkedThisClient: boolean;
  now?: Date;
}): { ok: true; already: boolean } | { ok: false; reason: ClientLinkRefusal | "code_not_found" } {
  const now = input.now ?? new Date();
  if (input.telegramIsStaff) return { ok: false, reason: "staff_telegram" };
  if (!input.code) return { ok: false, reason: "code_not_found" };
  if (input.code.used_at) return { ok: false, reason: "code_used" };
  if (input.code.expires_at.getTime() <= now.getTime()) return { ok: false, reason: "code_expired" };
  if (input.code.attempts >= LIMITS.maxCodeAttempts) return { ok: false, reason: "code_attempts" };
  if (!input.clientActive) return { ok: false, reason: "client_inactive" };
  if (input.alreadyLinkedThisClient) return { ok: true, already: true };
  if (input.activeLinksForClient >= LIMITS.maxTelegramPerClient) return { ok: false, reason: "too_many_for_client" };
  if (input.activeLinksForTelegram >= LIMITS.maxClientsPerTelegram) return { ok: false, reason: "too_many_for_telegram" };
  return { ok: true, already: false };
}

/** Telefon mosligi: mijoz telefoni yoki kontaktlaridan biri (oxirgi 9 raqam). */
export function phoneMatchesClient(sharedKey: string | null, clientKeys: Array<string | null>): boolean {
  if (!sharedKey) return false;
  return clientKeys.some((k) => k != null && k === sharedKey);
}

/** Kontakt foydalanuvchining o'ziniki ekanini tekshirish (boshqa kontaktni forward qilish taqiqlanadi). */
export function contactIsOwn(contactUserId: number | undefined, fromId: number): boolean {
  return contactUserId != null && contactUserId === fromId;
}

/** Soatlik muvaffaqiyatsiz urinishlar bo'yicha blok tugash vaqti (yoki null). */
export function blockUntil(failTimes: Date[], now = new Date()): Date | null {
  const hourAgo = now.getTime() - 3600_000;
  const recent = failTimes.filter((d) => d.getTime() >= hourAgo).sort((a, b) => a.getTime() - b.getTime());
  if (recent.length < LIMITS.maxFailsPerHour) return null;
  const last = recent[recent.length - 1];
  return new Date(last.getTime() + LIMITS.blockMinutes * 60_000);
}
