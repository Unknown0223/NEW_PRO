import type { FastifyCorsOptions } from "@fastify/cors";
import { env } from "../config/env";
import { logger } from "../config/logger";

/** Productionda localhost originlarni rad etish. */
export function isLocalhostOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

function logCorsRejected(origin: string | undefined, reason: string): void {
  logger.warn({ event: "cors_rejected", origin: origin ?? null, reason });
}

/**
 * Development/test: `CORS_ALLOWED_ORIGINS` bo‘sh bo‘lsa barcha originlar.
 * Production: `CORS_ALLOWED_ORIGINS` (vergul bilan) — startupda tekshiriladi ([env.ts](../config/env.ts)).
 * Production qoidalari: `!origin → false`, localhost blok, rad etilgan origin log (`cors_rejected`).
 */
export function buildCorsOrigin(): FastifyCorsOptions["origin"] {
  const raw = env.CORS_ALLOWED_ORIGINS?.trim();
  const isProduction = env.NODE_ENV === "production";

  if (!raw) {
    return true;
  }

  const allowed = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));

  return (origin, callback) => {
    if (!origin) {
      if (isProduction) {
        logCorsRejected(undefined, "missing_origin");
        callback(null, false);
        return;
      }
      callback(null, true);
      return;
    }

    if (isProduction && isLocalhostOrigin(origin)) {
      logCorsRejected(origin, "localhost_blocked");
      callback(new Error(`CORS: localhost origin blocked in production: ${origin}`), false);
      return;
    }

    if (allowed.has(origin)) {
      callback(null, true);
      return;
    }

    logCorsRejected(origin, "not_in_allowlist");
    callback(new Error(`CORS: origin not allowed: ${origin}`), false);
  };
}
