import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import {
  ORDER_EVENT_CHANNEL,
  createOrderUpdatedPayload,
  isOrderUpdatedPayload,
  type OrderUpdatedPayload
} from "../domain/events/order.events";
import { createRedisClient } from "./redis-client";

/** @deprecated Use `OrderUpdatedPayload` from domain catalog. */
export type OrderStreamPayload = OrderUpdatedPayload;

const CHANNEL = ORDER_EVENT_CHANNEL;

const bus = new EventEmitter();
bus.setMaxListeners(500);

let pub: Redis | null = null;
let sub: Redis | null = null;
let useRedis = false;

type OrderEventBusLog = {
  warn: (obj: unknown, msg?: string) => void;
  info: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

function emitLocal(payload: OrderStreamPayload): void {
  bus.emit("order", payload);
}

function logRedisError(
  log: OrderEventBusLog | undefined,
  client: "pub" | "sub",
  err: unknown
): void {
  const payload = { err, redisContext: `order-event-bus-${client}` };
  if (log?.error) {
    log.error(payload, "redis_connection_error");
  } else if (log?.warn) {
    log.warn(payload, "redis_connection_error");
  }
}

/**
 * Redis mavjud bo‘lsa: `emit` faqat `PUBLISH` (barcha instanslar `SUBSCRIBE` orqali lokal busga ulashadi).
 * Redis yo‘q yoki ulanish xato bo‘lsa: faqat jarayon ichidagi EventEmitter.
 */
export async function initOrderEventBusRedis(log?: OrderEventBusLog): Promise<void> {
  try {
    const opts = {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 3000,
      retryStrategy: (): null => null
    };
    pub = await createRedisClient(opts, "order-event-bus-pub");
    sub = await createRedisClient(opts, "order-event-bus-sub");
    pub.on("error", (err) => logRedisError(log, "pub", err));
    sub.on("error", (err) => logRedisError(log, "sub", err));
    await Promise.all([pub.connect(), sub.connect()]);
    await Promise.all([pub.ping(), sub.ping()]);
    await sub.subscribe(CHANNEL);
    sub.on("message", (_ch, message) => {
      try {
        const payload: unknown = JSON.parse(message);
        if (isOrderUpdatedPayload(payload)) {
          emitLocal(payload);
        }
      } catch {
        /* ignore malformed payload */
      }
    });
    useRedis = true;
    log?.info({}, "Order event bus: Redis pub/sub enabled");
  } catch (e) {
    log?.warn({ err: e }, "Order event bus: Redis unavailable, in-process only");
    useRedis = false;
    if (pub) {
      try {
        pub.removeAllListeners("error");
      } catch {
        /* ignore */
      }
      pub.disconnect();
      pub = null;
    }
    if (sub) {
      try {
        sub.removeAllListeners("error");
      } catch {
        /* ignore */
      }
      sub.disconnect();
      sub = null;
    }
  }
}

export async function closeOrderEventBusRedis(): Promise<void> {
  useRedis = false;
  const tasks: Promise<unknown>[] = [];
  if (pub) {
    tasks.push(pub.quit().catch(() => pub!.disconnect()));
    pub = null;
  }
  if (sub) {
    tasks.push(sub.quit().catch(() => sub!.disconnect()));
    sub = null;
  }
  await Promise.all(tasks);
}

export function emitOrderUpdated(tenantId: number, orderId: number): void {
  const payload = createOrderUpdatedPayload(tenantId, orderId);
  if (useRedis && pub) {
    void pub.publish(CHANNEL, JSON.stringify(payload)).catch((err) => {
      logRedisError(undefined, "pub", err);
      emitLocal(payload);
    });
  } else {
    emitLocal(payload);
  }
}

export function subscribeOrderEvents(listener: (p: OrderStreamPayload) => void): () => void {
  bus.on("order", listener);
  return () => {
    bus.off("order", listener);
  };
}

export function isOrderEventBusRedisEnabled(): boolean {
  return useRedis;
}
