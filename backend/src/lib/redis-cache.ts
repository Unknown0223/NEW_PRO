import type { Redis } from "ioredis";
import { env } from "../config/env";

/**
 * Umumiy maqsaddagi Redis client — Dashboard cache, narxlar cache, stock cache va h.k.
 * `order-event-bus.ts` o'zining pub/sub connectionlarini ishlatadi.
 */

let appRedis: Redis | null = null;

export async function getRedisForApp(): Promise<Redis> {
  if (appRedis && appRedis.status === "ready") {
    return appRedis;
  }

  try {
    const IORedis = (await import("ioredis")).default;
    appRedis = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        return times > 5 ? null : Math.min(times * 50, 2000);
      },
      lazyConnect: true
    });

    await appRedis.connect();
    return appRedis;
  } catch {
    // Redis mavjud emas — in-memory fallback
    return createInMemoryRedis();
  }
}

/** `/ready` va monitoring: dashboard keshi uchun Redis PING. */
export async function pingAppRedis(): Promise<"ok" | "down"> {
  try {
    const redis = await getRedisForApp();
    const pong = await redis.ping();
    return String(pong).toUpperCase() === "PONG" ? "ok" : "down";
  } catch {
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

function createInMemoryRedis(): Redis {
  // Minimal mock — `get`, `set`, `del` ishlaydi
  const mockRedis: any = {};
  mockRedis.status = "ready";
  mockRedis.ping = async () => "PONG";
  mockRedis.get = async (key: string) => {
    pruneMemoryStore();
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value;
  };
  mockRedis.set = async (key: string, value: string, ...args: string[]) => {
    pruneMemoryStore();
    let ttl: number | null = null;
    for (let i = 0; i < args.length; i++) {
      if (args[i].toUpperCase() === "EX" && args[i + 1]) {
        ttl = Number(args[i + 1]) * 1000;
        i++;
      }
    }
    memoryStore.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl : null
    });
    pruneMemoryStore();
    return "OK";
  };
  mockRedis.del = async (key: string) => {
    return memoryStore.delete(key) ? 1 : 0;
  };
  mockRedis.disconnect = () => Promise.resolve();
  mockRedis.quit = async () => Promise.resolve();
  return mockRedis as Redis;
}

export async function getAppCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisForApp();
    const cached = await redis.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

export async function setAppCache(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    const ttl = Math.max(1, Math.min(ttlSeconds, 86_400));
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    /* ignore */
  }
}

export function tenantSettingsCacheKey(tenantId: number): string {
  return `tenant:${tenantId}:settings`;
}

/** Barcha tenant dashboard cache kalitlarini o'chirish */
export async function invalidateDashboard(tenantId: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await redis.del(`tenant:${tenantId}:dashboard`);
  } catch {
    // ignore — in-memory fallback'da ham o'chirish mumkin
  }
}

/** Narxlar cache invalidatsiya */
export async function invalidatePrices(tenantId: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await redis.del(`tenant:${tenantId}:prices`);
  } catch {
    /* ignore */
  }
  await invalidatePriceTypesCache(tenantId);
}

/** `listDistinctPriceTypesForTenant` Redis kalitlari */
export async function invalidatePriceTypesCache(tenantId: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    await Promise.all([
      redis.del(`tenant:${tenantId}:price_types:sale`),
      redis.del(`tenant:${tenantId}:price_types:purchase`),
      redis.del(`tenant:${tenantId}:price_types:all`)
    ]);
  } catch {
    /* ignore */
  }
}

/** `listOrdersPaged` Redis/in-memory keshi — status o‘zgarganda majburiy tozalash. */
export async function invalidateOrdersListCache(tenantId: number): Promise<void> {
  const prefix = `tenant:${tenantId}:orders:list:`;
  pruneMemoryStore();
  for (const key of [...memoryStore.keys()]) {
    if (key.startsWith(prefix)) memoryStore.delete(key);
  }
  try {
    const redis = await getRedisForApp();
    const keys = await redis.keys(`${prefix}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    /* ignore */
  }
}

/** Stock cache invalidatsiya */
export async function invalidateStock(tenantId: number, warehouseId?: number): Promise<void> {
  try {
    const redis = await getRedisForApp();
    if (warehouseId != null) {
      await redis.del(`tenant:${tenantId}:stock:${warehouseId}`);
    }
    await redis.del(`tenant:${tenantId}:stock:all`);
  } catch {
    /* ignore */
  }
}
