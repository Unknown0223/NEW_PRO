import { env } from "../config/env";

/**
 * Fastify `trustProxy` qiymatini parse qiladi.
 * - `true` / `1` → barcha proxy hop'lariga ishonish
 * - raqam → hop soni (masalan `1` = bitta nginx)
 * - vergul bilan IP/CIDR ro'yxati
 */
export function parseTrustProxyRaw(
  raw: string | undefined,
  nodeEnv: string
): boolean | number | string | string[] {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return nodeEnv === "production" ? 1 : false;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") {
    return true;
  }
  if (lower === "false" || lower === "0" || lower === "no") {
    return false;
  }
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10);
  }
  if (trimmed.includes(",")) {
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return trimmed;
}

/** Productionda `TRUST_PROXY` majburiy (env.ts). */
export function resolveTrustProxy(): boolean | number | string | string[] {
  return parseTrustProxyRaw(env.TRUST_PROXY, env.NODE_ENV);
}
