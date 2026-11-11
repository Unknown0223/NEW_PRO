import IORedis from "ioredis";
import { env } from "../config/env";
import { attachRedisErrorLogging, buildRedisOptions, isRedisSentinelEnabled } from "./redis-client";

/**
 * Rate-limit uchun synx Redis client (lazyConnect).
 * buildApp sync qolishi uchun — getRedisForApp() async emas.
 */
export function createRateLimitRedis(): IORedis | undefined {
  try {
    const opts = buildRedisOptions({
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      lazyConnect: true
    });
    const client = isRedisSentinelEnabled()
      ? new IORedis(opts)
      : new IORedis(env.REDIS_URL, opts);
    attachRedisErrorLogging(client, "app-cache");
    return client;
  } catch {
    return undefined;
  }
}
