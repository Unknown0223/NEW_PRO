/**
 * AI Assistant — bir martalik tokenlar uchun store.
 *
 * Redis mavjud bo‘lsa — `SET NX EX` (PM2 cluster’da umumiy).
 * Redis yo‘q bo‘lsa — jarayon ichidagi TTL Map (dev/test uchun).
 */
import { getRedisForApp } from "../../lib/redis-cache";

const used = new Map<string, number>();
const MAX_ENTRIES = 2_000;

function cleanup(now: number): void {
  if (used.size < MAX_ENTRIES) return;
  for (const [key, expiresAt] of used) {
    if (expiresAt <= now) used.delete(key);
  }
  if (used.size >= MAX_ENTRIES) {
    const first = used.keys().next().value;
    if (first) used.delete(first);
  }
}

/**
 * `true` — token birinchi marta ishlatilmoqda.
 * `false` — allaqachon ishlatilgan (yoki band).
 */
export async function claimOnce(jti: string, ttlSec: number): Promise<boolean> {
  const key = `salec:ai:${jti}`;
  try {
    const redis = await getRedisForApp();
    const result = await redis.call("SET", key, "1", "EX", String(ttlSec), "NX");
    return result === "OK";
  } catch {
    const now = Date.now();
    cleanup(now);
    const expiresAt = used.get(jti);
    if (expiresAt !== undefined && expiresAt > now) return false;
    used.set(jti, now + ttlSec * 1000);
    return true;
  }
}

/** Testlar uchun. */
export function resetClaimStore(): void {
  used.clear();
}
