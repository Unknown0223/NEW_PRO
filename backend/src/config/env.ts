import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// cwd ga bog‘liq emas: `backend/.env` va loyiha ildizidagi `.env` (masalan monorepo)
config({ path: resolve(__dirname, "../../.env") });
config({ path: resolve(__dirname, "../../../.env") });
// Lokal dev: backend/.env.local production Railway o‘zgaruvchilarini ustiga yozmaydi
if (process.env.NODE_ENV !== "production") {
  config({ path: resolve(process.cwd(), ".env.local"), override: true });
}

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
        : "postgresql://postgres:changeme_local_dev@localhost:15432/savdo_db"
    ),
  REDIS_URL: z.string().min(1).default(
    process.env.NODE_ENV === "production"
      ? (undefined as unknown as string)
      : "redis://localhost:6379"
  ),
  /** Sentinel: vergul bilan `host:port` (port ixtiyoriy, default 26379). */
  REDIS_SENTINEL_HOSTS: z.string().optional(),
  /** Sentinel master nomi (masalan `mymaster`). `REDIS_SENTINEL_HOSTS` bilan birga. */
  REDIS_SENTINEL_MASTER_NAME: z.string().optional(),
  /** Global multipart limit (Fastify). APK route alohida yuqori limit bilan ro‘yxatdan o‘tadi. */
  MULTIPART_MAX_FILE_BYTES: z.coerce.number().int().positive().default(32 * 1024 * 1024),
  /** Excel import route-level limit (baytlarda). */
  MULTIPART_EXCEL_MAX_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024),
  /** Mobil APK upload limit (baytlarda). */
  MULTIPART_APK_MAX_BYTES: z.coerce.number().int().positive().default(120 * 1024 * 1024),
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
  /** POST write API (zakaz/to‘lov/mijoz) — bir IP dan maksimal so‘rovlar (oyna) */
  WRITE_API_RATE_MAX: z.coerce.number().int().positive().default(120),
  WRITE_API_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  /**
   * `1` bo‘lsa: `/dashboard/*` so‘rovlari uchun `request.log` ga `dashboard.request` yoziladi
   * va javobga `X-Dashboard-Duration-Ms` qo‘shiladi (ms).
   */
  DASHBOARD_PERF_LOG: z.enum(["0", "1"]).default("0"),
  /** Redis snapshot kesh: supervisor/sales/sales-monitoring (5–600 s). */
  DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  /** `1` bo‘lsa: har 2 daqiqada joriy oy uchun sales-monitoring summary keshini oldindan hisoblaydi. */
  DASHBOARD_CACHE_WARMING: z.enum(["0", "1"]).default("0"),
  /** `listProductsForOrderCreateForm`: `IN (...)` bo‘laklari o‘lchami. */
  ORDER_CREATE_PRODUCT_CHUNK: z.coerce.number().int().min(50).max(2000).default(750),
  /** Shu vaqtda parallel `findMany` chaqiruvlari soni. */
  ORDER_CREATE_PRODUCT_CHUNK_PARALLEL: z.coerce.number().int().min(1).max(16).default(4),
  /** Agent katalogi: `order_items` dan `GROUP BY product_id` LIMIT. */
  LINKAGE_AGENT_SOLD_PRODUCT_IDS_LIMIT: z.coerce.number().int().min(500).max(20000).default(8000),
  /** FCM legacy HTTP API server key (ixtiyoriy — push xabarlari uchun). */
  FCM_SERVER_KEY: z.string().optional(),
  /**
   * `1` bo‘lsa: markazlashgan strukturali ruxsat tekshiruvi (route-permission-guard) yoqiladi.
   * Default `0` — faqat migratsiya + rol default'lari seed qilingach yoqing (aks holda eski
   * foydalanuvchilar 403 oladi). Tekshiruv `admin` rolni chetlab o‘tadi.
   */
  RBAC_ENFORCE_PERMISSIONS: z.enum(["0", "1"]).default("0"),

  /**
   * Foydalanuvchi xatti-harakat kuzatuvi (page-view, davomiylik, form niyatlari).
   * Default `1` (yoqilgan). Xavfsiz rollout uchun `0` bilan o‘chiriladi.
   */
  ACTIVITY_TRACKING_ENABLED: z.enum(["0", "1"]).default("1"),

  /** UserActivityEvent yozuvlarining saqlash muddati (kun). Eskilari cron bilan tozalanadi. */
  ACTIVITY_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  /** `/ready` endpoint: `x-internal-token` header bilan himoya (ixtiyoriy). */
  INTERNAL_HEALTH_TOKEN: z.string().min(16).optional(),

  /** Sentry DSN — berilmasa Sentry o‘chiq. */
  SENTRY_DSN: z.string().url().optional(),

  /** OpenTelemetry OTLP endpoint (masalan http://otel-collector:4318/v1/traces). */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_SERVICE_NAME: z.string().default("salec-backend"),

  /** Verbose request log sampling (0.0–1.0). Default 1.0 = har doim. */
  LOG_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),

  /** S3/R2 object storage (ixtiyoriy — yoqilmasa lokal disk). */
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

export const env = parsed.data;

if (env.NODE_ENV === "production") {
  const badProdDefaults: string[] = [];
  const unsafeDbUrls = new Set([
    "postgresql://postgres:0223@localhost:5432/savdo_db",
    "postgresql://postgres:0223@localhost:15432/savdo_db",
    "postgresql://postgres:changeme_local_dev@localhost:15432/savdo_db"
  ]);
  if (unsafeDbUrls.has(env.DATABASE_URL)) {
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
  if (env.RBAC_ENFORCE_PERMISSIONS !== "1") {
    throw new Error(
      "RBAC_ENFORCE_PERMISSIONS must be '1' in production. " +
        "Ensure all tenants have run: npm run seed:rbac-defaults"
    );
  }
}

/** Prisma `schema.prisma` to‘g‘ridan-to‘g‘ri `process.env.DATABASE_URL` ni o‘qiydi; zod default faqat `env` obyektida bo‘lib qolmasin. */
process.env.DATABASE_URL = env.DATABASE_URL;
process.env.REDIS_URL = env.REDIS_URL;
