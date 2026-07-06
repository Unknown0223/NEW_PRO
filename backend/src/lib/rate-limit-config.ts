import { env } from "../config/env";

/** POST write endpointlar (zakaz, to‘lov, mijoz yaratish) — IP bo‘yicha limit. */
export const writeApiRateLimitRouteOpts = {
  config: {
    rateLimit: {
      max: env.WRITE_API_RATE_MAX,
      timeWindow: env.WRITE_API_RATE_WINDOW_MS
    }
  }
} as const;
