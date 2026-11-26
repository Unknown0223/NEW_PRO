/** Lokal «По ценам» demo — prod product/schedule ga tegmasin. */

export const PRICES_SEED_SKU = "PRICES-SEED";
export const PRICES_SEED_NAME = "PRICES-SEED Demo Product";
export const PRICES_SEED_PRICE_TYPE = "base";

export function isLocalDatabaseUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = (u.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return /@(localhost|127\.0\.0\.1|::1)([:/]|$)/i.test(url);
  }
}
