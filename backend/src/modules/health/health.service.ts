import { prisma } from "../../config/database";
import { isOrderEventBusRedisEnabled } from "../../lib/order-event-bus";
import { pingAppRedis } from "../../lib/redis-cache";

export type ReadinessReport = {
  status: "ready" | "not_ready";
  database: "ok" | "down";
  redis: "ok" | "degraded" | "down";
  app_cache_redis: "ok" | "down";
  time: string;
  timezone: string;
  time_local: string;
};

function clockSnapshot(): { time: string; timezone: string; time_local: string } {
  const now = new Date();
  const timezone = process.env.TZ?.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const time_local = now.toLocaleString("sv-SE", { timeZone: "Asia/Tashkent", hour12: false });
  return { time: now.toISOString(), timezone, time_local };
}

export async function checkReadiness(): Promise<ReadinessReport> {
  const clock = clockSnapshot();
  const eventBusRedis = isOrderEventBusRedisEnabled() ? "ok" : "degraded";

  try {
    await prisma.$queryRaw`SELECT 1`;
    const appCacheRedis = await pingAppRedis();
    return {
      status: "ready",
      database: "ok",
      redis: eventBusRedis,
      app_cache_redis: appCacheRedis,
      ...clock
    };
  } catch {
    const appCacheRedis = await pingAppRedis().catch(() => "down" as const);
    return {
      status: "not_ready",
      database: "down",
      redis: eventBusRedis,
      app_cache_redis: appCacheRedis,
      ...clock
    };
  }
}
