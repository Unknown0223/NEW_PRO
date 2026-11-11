import { getRedisForApp } from "./redis-cache";

/**
 * Cluster’da bir nechta API instans bir cron’ni parallel ishlatmasin.
 * Redis SET NX — lock olinmasa skip; Redis yo‘q bo‘lsa fn baribir chaqiriladi.
 */
export async function withCronLock(
  name: string,
  ttlMs: number,
  fn: () => Promise<void>
): Promise<"ran" | "skipped" | "ran_unlocked"> {
  const key = `cron-lock:${name}`;
  const ttlSec = Math.max(1, Math.ceil(ttlMs / 1000));
  try {
    const redis = await getRedisForApp();
    const ok = await redis.set(key, String(Date.now()), "EX", ttlSec, "NX");
    if (ok !== "OK") return "skipped";
    try {
      await fn();
      return "ran";
    } finally {
      try {
        await redis.del(key);
      } catch {
        /* TTL tugatadi */
      }
    }
  } catch {
    await fn();
    return "ran_unlocked";
  }
}
