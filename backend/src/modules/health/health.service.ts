import { prisma } from "../../config/database";
import { isOrderEventBusRedisEnabled } from "../../lib/order-event-bus";
import { pingAppRedis } from "../../lib/redis-cache";

export type ReadinessReport = {
  status: "ready" | "not_ready";
  database: "ok" | "down";
  redis: "ok" | "degraded" | "down";
  app_cache_redis: "ok" | "down";
  time: string;
};

export async function checkReadiness(): Promise<ReadinessReport> {
  const time = new Date().toISOString();
  const eventBusRedis = isOrderEventBusRedisEnabled() ? "ok" : "degraded";

  try {
    await prisma.$queryRaw`SELECT 1`;
    const appCacheRedis = await pingAppRedis();
    return {
      status: "ready",
      database: "ok",
      redis: eventBusRedis,
      app_cache_redis: appCacheRedis,
      time
    };
  } catch {
    const appCacheRedis = await pingAppRedis().catch(() => "down" as const);
    return {
      status: "not_ready",
      database: "down",
      redis: eventBusRedis,
      app_cache_redis: appCacheRedis,
      time
    };
  }
}
