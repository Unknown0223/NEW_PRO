import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// cwd ga bog‘liq emas: `backend/.env` va loyiha ildizidagi `.env` (masalan monorepo)
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /**
   * Lokal dev: past portlar (4000–4050 atrofi) Windows’da Hyper-V excluded range ichida
   * `listen EACCES` berishi mumkin — yuqori port + `127.0.0.1` (index.ts) xavfsizroq.
   */
  PORT: z.coerce.number().int().positive().default(18080),
  DATABASE_URL: z
    .string()
    .min(1)
    .default(
      process.env.NODE_ENV === "production"
        ? (undefined as unknown as string)
        : "postgresql://postgres:0223@localhost:5432/savdo_db"
    ),
  REDIS_URL: z.string().min(1).default(
    process.env.NODE_ENV === "production"
      ? (undefined as unknown as string)
      : "redis://localhost:6379"
  ),
  /** Excel import va boshqa multipart fayllar (baytlarda). */
  MULTIPART_MAX_FILE_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  /**
   * JWT secrets — productionda majburiy, faqat dev/test uchun default.
   * Generatsiya: openssl rand -hex 32
   */
  JWT_ACCESS_SECRET: z.string().min(32).default(
    process.env.NODE_ENV === "production"
      ? (undefined as unknown as string)
      : "dev-access-secret-change-in-production-min-32-chars"
  ),
  JWT_REFRESH_SECRET: z.string().min(32).default(
    process.env.NODE_ENV === "production"
      ? (undefined as unknown as string)
      : "dev-refresh-secret-change-in-production-min-32-chars"
  ),
  /** Productionda majburiy: vergul bilan ajratilgan ruxsat etilgan Origin lar (masalan https://panel.example.com) */
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  /** POST /auth/login va /api/auth/login uchun bir IP dan maksimal urinishlar (oyna) */
  AUTH_LOGIN_RATE_MAX: z.coerce.number().int().positive().default(30),
  /** Login rate limit oynasi (ms), masalan 900000 = 15 daqiqa */
  AUTH_LOGIN_RATE_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  /**
   * `1` bo‘lsa: `/dashboard/*` so‘rovlari uchun `request.log` ga `dashboard.request` yoziladi
   * va javobga `X-Dashboard-Duration-Ms` qo‘shiladi (ms).
   */
  DASHBOARD_PERF_LOG: z.enum(["0", "1"]).default("0"),
  /** Redis snapshot kesh: supervisor/sales/sales-monitoring (5–600 s). */
  DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(15),
  /** `listProductsForOrderCreateForm`: `IN (...)` bo‘laklari o‘lchami. */
  ORDER_CREATE_PRODUCT_CHUNK: z.coerce.number().int().min(50).max(2000).default(750),
  /** Shu vaqtda parallel `findMany` chaqiruvlari soni. */
  ORDER_CREATE_PRODUCT_CHUNK_PARALLEL: z.coerce.number().int().min(1).max(16).default(4),
  /** Agent katalogi: `order_items` dan `GROUP BY product_id` LIMIT. */
  LINKAGE_AGENT_SOLD_PRODUCT_IDS_LIMIT: z.coerce.number().int().min(500).max(20000).default(8000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;

if (env.NODE_ENV === "production") {
  const badProdDefaults: string[] = [];
  if (env.DATABASE_URL === "postgresql://postgres:0223@localhost:5432/savdo_db") {
    badProdDefaults.push("DATABASE_URL");
  }
  if (env.REDIS_URL === "redis://localhost:6379") {
    badProdDefaults.push("REDIS_URL");
  }
  if (env.JWT_ACCESS_SECRET === "dev-access-secret-change-in-production-min-32-chars") {
    badProdDefaults.push("JWT_ACCESS_SECRET");
  }
  if (env.JWT_REFRESH_SECRET === "dev-refresh-secret-change-in-production-min-32-chars") {
    badProdDefaults.push("JWT_REFRESH_SECRET");
  }
  if (badProdDefaults.length > 0) {
    throw new Error(
      `Unsafe production environment defaults detected: ${badProdDefaults.join(", ")}`
    );
  }
  if (!env.CORS_ALLOWED_ORIGINS?.trim()) {
    throw new Error("Production requires CORS_ALLOWED_ORIGINS (comma-separated origins, e.g. https://app.example.com)");
  }
}

/** Prisma `schema.prisma` to‘g‘ridan-to‘g‘ri `process.env.DATABASE_URL` ni o‘qiydi; zod default faqat `env` obyektida bo‘lib qolmasin. */
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.REDIS_URL = env.REDIS_URL;
