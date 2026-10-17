export const MIN_NAME_LEN = 3;
export const PAGE_SIZE = 10;
export const EXCEL_MIN_CLIENTS = Number.parseInt(process.env.MIN_CLIENTS_FOR_EXCEL ?? "5", 10) || 5;

export function loadConfig() {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  const tenantSlug = (process.env.BOT_TENANT_SLUG ?? "test1").trim();
  const apiUrl = (process.env.SALEC_API_URL ?? "").trim().replace(/\/$/, "");
  const apiSecret = (process.env.TELEGRAM_BOT_API_SECRET ?? "").trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN kerak (.env)");
  if (!databaseUrl) throw new Error("DATABASE_URL kerak (.env) — SALEC Postgres");
  if (!apiUrl) throw new Error("SALEC_API_URL kerak (.env) — deploydagi backend");
  if (apiSecret.length < 16) throw new Error("TELEGRAM_BOT_API_SECRET kerak (.env), kamida 16 belgi");
  return { token, databaseUrl, tenantSlug, apiUrl, apiSecret, excelMin: EXCEL_MIN_CLIENTS };
}
