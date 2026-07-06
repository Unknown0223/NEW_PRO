import type { Redis } from "ioredis";
import CircuitBreaker from "opossum";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { createRedisClient } from "./redis-client";

/**
 * Umumiy maqsaddagi Redis client — Dashboard cache, narxlar cache, stock cache va h.k.
 * `order-event-bus.ts` o'zining pub/sub connectionlarini ishlatadi.
 */

let appRedis: Redis | null = null;
let usingMemoryFallback = false;

const redisOpBreaker = new CircuitBreaker(
  async <T>(operation: () => Promise<T>): Promise<T> => operation(),
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 30_000,
    volumeThreshold: 5
  }
);

redisOpBreaker.on("open", () => {
  logger.warn({ component: "redis-cache" }, "redis_circuit_breaker_open");
});
redisOpBreaker.on("halfOpen", () => {
  logger.info({ component: "redis-cache" }, "redis_circuit_breaker_half_open");
});
redisOpBreaker.on("close", () => {
  logger.info({ component: "redis-cache" }, "redis_circuit_breaker_closed");
});

async function runRedisOp<T>(operation: () => Promise<T>): Promise<T> {
  if (usingMemoryFallback) {
    throw new Error("REDIS_MEMORY_FALLBACK");
  }
  return (await redisOpBreaker.fire(operation)) as T;
}

export async function getRedisForApp(): Promise<Redis> {
  if (usingMemoryFallback) {
    return createInMemoryRedis();
  }

  if (appRedis && appRedis.status === "ready") {
    return appRedis;
  }

  try {
    appRedis = await createRedisClient(
      {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          return times > 5 ? null : Math.min(times * 50, 2000);
        }
      },
      "app-cache"
    );
    await runRedisOp(() => appRedis!.connect());
    await runRedisOp(() => appRedis!.ping());
    return appRedis;
  } catch (err) {
    logger.warn({ err, component: "redis-cache" }, "redis_unavailable_using_memory_fallback");
    usingMemoryFallback = true;
    if (appRedis) {
      try {
        appRedis.disconnect();
      } catch {
        /* ignore */
      }
      appRedis = null;
    }
    return createInMemoryRedis();
  }
}

/** `/ready` va monitoring: dashboard keshi uchun Redis PING. */
export async function pingAppRedis(): Promise<"ok" | "down"> {
  if (usingMemoryFallback) return "down";
  try {
    const redis = await getRedisForApp();
    const pong = await runRedisOp(() => redis.ping());
    return String(pong).toUpperCase() === "PONG" ? "ok" : "down";
  } catch (err) {
    logger.warn({ err, component: "redis-cache" }, "redis_ping_failed");
    return "down";
  }
}

// ---- In-memory fallback (Redis yo‘q bo‘lsa) ----

type CacheEntry = { value: string; expiresAt: number | null };
const memoryStore = new Map<string, CacheEntry>();
const MEMORY_STORE_MAX_ENTRIES = 5000;

function pruneMemoryStore(): void {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt != null && now > entry.expiresAt) {
      memoryStore.delete(key);
    }
  }
  if (memoryStore.size <= MEMORY_STORE_MAX_ENTRIES) return;
  const overflow = memoryStore.size - MEMORY_STORE_MAX_ENTRIES;
  const keys = memoryStore.keys();
  for (let i = 0; i < overflow; i++) {
    const k = keys.next().value;
    if (k != null) memoryStore.delete(k);
  }
}

function memoryGet(key: string): string | null {
  pruneMemoryStore();
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  pruneMemoryStore();
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
  });
  pruneMemoryStore();
}

function createInMemoryRedis(): Redis {
  const mockRedis: any = {};
  mockRedis.status = "ready";
  mockRedis.ping = async () => "PONG";
  mockRedis.get = async (key: string) => memoryGet(key);
  mockRedis.set = async (key: string, value: string, ...args: string[]) => {
    let ttl = 0;
    for (let i = 0; i < args.length; i++) {
      if (args[i].toUpperCase() === "EX" && args[i + 1]) {
        ttl = Number(args[i + 1]);
        i++;
      }
    }
    memorySet(key, value, ttl);
    return "OK";
  };
  mockRedis.del = async (key: string) => (memoryStore.delete(key) ? 1 : 0);
  mockRedis.keys = async (pattern: string) => {
    const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
    return [...memoryStore.keys()].filter((k) => k.startsWith(prefix));
  };
  mockRedis.disconnect = () => Promise.resolve();
  mockRedis.quit = async () => Promise.resolve();
  return mockRedis as Redis;
}

export async function getAppCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisForApp();
    const cached = await runRedisOp(() => redis.get(key));
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch (err) {
    logger.debug({ err, key, component: "redis-cache" }, "redis_get_fallback");
    const cached = memoryGet(key);
    if (!cached) return null;
    try {
      return JSON.parse(cached) as T;
    } catch {
      return null;
    }
  }
}

export async function setAppCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const ttl = Math.max(1, Math.min(ttlSeconds, 86_400));
  const payload = JSON.stringify(value);
  try {
    const redis = await getRedisForApp();
    await runRedisOp(() => redis.set(key, payload, "EX", String(ttl)));
  } catch (err) {
    logger.debug({ err, key, component: "redis-cache" }, "redis_set_fallback");
    memorySet(key, payload, ttl);
  }
}

/**
 * Tenant-namespaced Redis kalit prefiksi — horizontal scaling uchun izolyatsiya.
 * Format: `t:{tenantId}:{segments...}`
 */
export function tenantRedisKey(tenantId: number, ...segments: string[]): string {
  return `t:${tenantId}:${segments.join(":")}`;
}

export function ordersListCacheKey(tenantId: number, fingerprint: string): string {
  return `${tenantRedisKey(tenantId, "orders", "list")}:${fingerprint}`;
}

export function ordersListCachePrefix(tenantId: number): string {
  return `${tenantRedisKey(tenantId, "orders", "list")}:`;
}

export function clientDetailCacheKey(tenantId: number, clientId: number): string {
  return tenantRedisKey(tenantId, "client", "detail", String(clientId));
}

/** Mijoz kartasi keshi — balans / faollik yangilanganda. */
export async function invalidateClientDetailCache(tenantId: number, clientId: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await runRedisOp(() => redis.del(clientDetailCacheKey(tenantId, clientId)));
  } catch {
    memoryStore.delete(clientDetailCacheKey(tenantId, clientId));
  }
}

export function tenantSettingsCacheKey(tenantId: number): string {
  return tenantRedisKey(tenantId, "settings", "v2");
}

/** Tenant profil (settings) cache — patch/seed dan keyin */
export async function invalidateTenantSettingsCache(tenantId: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await runRedisOp(() => redis.del(tenantSettingsCacheKey(tenantId)));
  } catch {
    memoryStore.delete(tenantSettingsCacheKey(tenantId));
  }
}

/** Barcha tenant dashboard cache kalitlarini o'chirish */
export async function invalidateDashboard(tenantId: number): Promise<void> {
  const key = tenantRedisKey(tenantId, "dashboard");
  try {
    const redis = await getRedisForApp();
    await runRedisOp(() => redis.del(key));
  } catch {
    memoryStore.delete(key);
  }
}

/** Narxlar cache invalidatsiya */
export async function invalidatePrices(tenantId: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await runRedisOp(() => redis.del(tenantRedisKey(tenantId, "prices")));
  } catch {
    memoryStore.delete(tenantRedisKey(tenantId, "prices"));
  }
  await invalidatePriceTypesCache(tenantId);
}

/** `listDistinctPriceTypesForTenant` Redis kalitlari */
export async function invalidatePriceTypesCache(tenantId: number): Promise<void> {
  const keys = [
    tenantRedisKey(tenantId, "price_types", "sale"),
    tenantRedisKey(tenantId, "price_types", "purchase"),
    tenantRedisKey(tenantId, "price_types", "all")
  ];
  try {
    const redis = await getRedisForApp();
    await runRedisOp(() => Promise.all(keys.map((k) => redis.del(k))));
  } catch {
    for (const k of keys) memoryStore.delete(k);
  }
}

/** `listOrdersPaged` Redis/in-memory keshi — status o‘zgarganda majburiy tozalash. */
export async function invalidateOrdersListCache(tenantId: number): Promise<void> {
  const prefix = `${tenantRedisKey(tenantId, "orders", "list")}:`;
  pruneMemoryStore();
  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
  try {
    const redis = await getRedisForApp();
    const keys = await runRedisOp(() => redis.keys(`${prefix}*`));
    if (keys.length > 0) {
      await runRedisOp(() => redis.del(...keys));
    }
  } catch {
    /* in-memory already pruned */
  }
}

/** Stock cache invalidatsiya */
export async function invalidateStock(tenantId: number, warehouseId?: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    if (warehouseId != null) {
      await runRedisOp(() => redis.del(tenantRedisKey(tenantId, "stock", String(warehouseId))));
    }
    await runRedisOp(() => redis.del(tenantRedisKey(tenantId, "stock", "all")));
  } catch {
    if (warehouseId != null) {
      memoryStore.delete(tenantRedisKey(tenantId, "stock", String(warehouseId)));
    }
    memoryStore.delete(tenantRedisKey(tenantId, "stock", "all"));
  }
}

/** CLI seed/test skriptlari: Redis ulanishini yopish (process osilib qolmasin). */
export async function closeAppRedis(): Promise<void> {
  if (!appRedis) return;
  const client = appRedis;
  appRedis = null;
  usingMemoryFallback = false;
  try {
    if (client.status === "ready" || client.status === "connect") {
      await client.quit();
    }
  } catch {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}
