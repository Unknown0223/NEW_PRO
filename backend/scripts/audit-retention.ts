/**
 * Eski audit / jurnal yozuvlarini o‘chirish (cron asosiy; bu skript qo‘lda).
 *
 * Ishlatish (backend papkasida):
 *   npx tsx scripts/audit-retention.ts
 *   npm run audit:retention
 *
 * Muhit:
 *   AUDIT_RETENTION_DAYS (default 730)
 *   ACTIVITY_RETENTION_DAYS (default 90)
 *   AUDIT_RETENTION_SKIP_ACTIVITY=1 — faqat audit store lar
 *   AUDIT_RETENTION_TENANT_ID=123 — bitta tenant
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(__dirname, "../../.env") });

async function main() {
  // env load qilingach import — DATABASE_URL tayyor bo‘lsin.
  const { runAuditRetentionPurge } = await import("../src/modules/audit/audit-retention.service");

  const tenantRaw = process.env.AUDIT_RETENTION_TENANT_ID?.trim();
  const tenantId =
    tenantRaw != null && tenantRaw !== "" ? Number.parseInt(tenantRaw, 10) : undefined;
  const skipActivity =
    process.env.AUDIT_RETENTION_SKIP_ACTIVITY === "1" ||
    process.env.AUDIT_RETENTION_SKIP_ACTIVITY === "true";

  const result = await runAuditRetentionPurge({
    tenantId: Number.isFinite(tenantId) ? tenantId : undefined,
    skipActivity
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
