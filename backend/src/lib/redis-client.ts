import type { Redis, RedisOptions } from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export type RedisLogContext = "app-cache" | "order-event-bus-pub" | "order-event-bus-sub";

function parseSentinelHosts(raw: string): Array<{ host: string; port: number }> {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const colon = entry.lastIndexOf(":");
      if (colon === -1) {
        return { host: entry, port: 26379 };
      }
      const host = entry.slice(0, colon).trim();
      const port = Number.parseInt(entry.slice(colon + 1), 10);
      return { host, port: Number.isFinite(port) ? port : 26379 };
    });
}

export function isRedisSentinelEnabled(): boolean {
  return Boolean(env.REDIS_SENTINEL_HOSTS?.trim() && env.REDIS_SENTINEL_MASTER_NAME?.trim());
}

export function buildRedisOptions(overrides?: Partial<RedisOptions>): RedisOptions {
  const base: RedisOptions = {
    lazyConnect: true,
    enableReadyCheck: true,
    ...overrides
  };

  if (isRedisSentinelEnabled()) {
    return {
      ...base,
      sentinels: parseSentinelHosts(env.REDIS_SENTINEL_HOSTS!),
      name: env.REDIS_SENTINEL_MASTER_NAME!.trim()
    };
  }

  return base;
}

export function attachRedisErrorLogging(client: Redis, context: RedisLogContext): void {
  client.on("error", (err) => {
    logger.warn({ err, redisContext: context }, "redis_connection_error");
  });
}

export async function createRedisClient(
  overrides?: Partial<RedisOptions>,
  logContext: RedisLogContext = "app-cache"
): Promise<Redis> {
  const IORedis = (await import("ioredis")).default;
  const opts = buildRedisOptions(overrides);
  const client = isRedisSentinelEnabled() ? new IORedis(opts) : new IORedis(env.REDIS_URL, opts);
  attachRedisErrorLogging(client, logContext);
  return client;
}
