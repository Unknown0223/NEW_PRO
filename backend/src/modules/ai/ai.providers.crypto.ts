/** AI API key — AES-256-GCM (JWT_ACCESS_SECRET dan hosil). */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";

const IV_LEN = 12;
const TAG_LEN = 16;

function secretKey(): Buffer {
  return createHash("sha256").update(`salec-ai-provider-key:${env.JWT_ACCESS_SECRET}`).digest();
}

/** Bo‘sh satr → bo‘sh. */
export function encryptApiKey(plain: string): string {
  const text = plain.trim();
  if (!text) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptApiKey(blob: string): string {
  const raw = blob.trim();
  if (!raw) return "";
  try {
    const buf = Buffer.from(raw, "base64url");
    if (buf.length < IV_LEN + TAG_LEN + 1) return "";
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskApiKey(plain: string): string | null {
  const t = plain.trim();
  if (!t) return null;
  if (t.length <= 8) return "••••";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}
