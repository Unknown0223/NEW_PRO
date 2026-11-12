/**
 * AI Assistant — imzolangan va shifrlangan tokenlar (confirm / export).
 *
 * Format: `base64url(iv[12] | tag[16] | ciphertext)`.
 * AES-256-GCM — maxfiylik (parol kabi parametrlar tokenda o‘qilmaydi) + yaxlitlik.
 * Kalit: `JWT_ACCESS_SECRET` dan hosil qilinadi (alohida env shart emas).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";

const IV_LEN = 12;
const TAG_LEN = 16;

export type TokenKind = "confirm" | "export";

export type TokenPayload = {
  /** confirm | export */
  kind: TokenKind;
  /** Bitta martalik identifikator. */
  jti: string;
  /** Foydalanuvchi id (majburiy mos kelishi kerak). */
  sub: number;
  /** Tenant id (majburiy mos kelishi kerak). */
  tid: number;
  /** Tool id (`__export__` — ko‘p tool’li eksport). */
  tool: string;
  /** Tool parametrlari (ichki `_` maydonlarsiz). */
  params: Record<string, unknown>;
  /** Eksport uchun: qayta bajariladigan tool chaqiruvlari. */
  calls?: Array<{ tool: string; params: Record<string, unknown> }>;
  /** Format (export uchun). */
  fmt?: "xlsx" | "csv";
  /** Yaratilgan vaqt (epoch ms). */
  iat: number;
  /** Amal qilish muddati (epoch ms). */
  exp: number;
};

export type TokenError = "invalid" | "expired";

function secretKey(): Buffer {
  return createHash("sha256").update(`salec-ai-assistant:${env.JWT_ACCESS_SECRET}`).digest();
}

export function newJti(): string {
  return randomBytes(12).toString("hex");
}

export function signToken(payload: TokenPayload): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const plain = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
}

export function verifyToken(token: string, now: number = Date.now()): { ok: true; payload: TokenPayload } | { ok: false; error: TokenError } {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length <= IV_LEN + TAG_LEN) return { ok: false, error: "invalid" };
    const iv = raw.subarray(0, IV_LEN);
    const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = raw.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload = JSON.parse(plain.toString("utf8")) as TokenPayload;
    if (!payload || typeof payload !== "object" || !payload.tool || !payload.jti) {
      return { ok: false, error: "invalid" };
    }
    if (typeof payload.exp !== "number" || payload.exp < now) return { ok: false, error: "expired" };
    if (payload.kind !== "confirm" && payload.kind !== "export") return { ok: false, error: "invalid" };
    return { ok: true, payload };
  } catch {
    return { ok: false, error: "invalid" };
  }
}

/** Token egasi joriy foydalanuvchi/tenant bilan mos kelishi shart. */
export function tokenBelongsTo(payload: TokenPayload, userId: number | null, tenantId: number): boolean {
  if (userId === null) return false;
  return payload.sub === userId && payload.tid === tenantId;
}
