/**
 * Lokal: ZIP backup → tenant import (to‘liq).
 *
 *   npx tsx scripts/apply-backup-zip-once.ts "C:\path\to\salec-backup.zip"
 *   IMPORT_TENANT_SLUG=test1 (default)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import { prisma } from "../src/config/database";
import { applyBackupZip } from "../src/modules/system-migration/system-migration.import";

if (!process.env.DATABASE_URL?.trim() && !process.env.RAILWAY_ENVIRONMENT) {
  loadDotenv();
}

async function main() {
  const zipArg = process.argv[2]?.trim();
  if (!zipArg) {
    console.error("Foydalanish: npx tsx scripts/apply-backup-zip-once.ts <backup.zip>");
    process.exit(1);
  }
  const zipPath = resolve(zipArg);
  if (!existsSync(zipPath)) {
    console.error(`[apply-backup] Fayl topilmadi: ${zipPath}`);
    process.exit(1);
  }

  const slug = (process.env.IMPORT_TENANT_SLUG ?? "test1").trim();
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) {
    console.error(`[apply-backup] Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  const buf = readFileSync(zipPath);
  console.log(
    `[apply-backup] tenant=${tenant.slug} (#${tenant.id}) zip=${zipPath} size=${buf.length}`
  );

  const result = await applyBackupZip(buf, tenant.id, {
    force_nonempty: true,
    mode: "full",
    conflict_policy: "replace",
    actorUserId: null,
    onProgress: (p) => {
      console.log(`[progress] ${p.percent}% ${p.stage}: ${p.message}`);
    }
  });

  console.log("\n[apply-backup] NATIJA");
  console.log(JSON.stringify(result, null, 2));

  const [clients, products, users, orders, payments, bonusRules, warehouses] = await Promise.all([
    prisma.client.count({ where: { tenant_id: tenant.id } }),
    prisma.product.count({ where: { tenant_id: tenant.id } }),
    prisma.user.count({ where: { tenant_id: tenant.id } }),
    prisma.order.count({ where: { tenant_id: tenant.id } }),
    prisma.payment.count({ where: { tenant_id: tenant.id } }),
    prisma.bonusRule.count({ where: { tenant_id: tenant.id } }),
    prisma.warehouse.count({ where: { tenant_id: tenant.id } })
  ]);
  console.log("\n[counts]", { clients, products, users, orders, payments, bonusRules, warehouses });
}

main()
  .catch((e) => {
    console.error("[apply-backup] XATO:", e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
