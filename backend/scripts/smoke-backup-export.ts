/**
 * Prod smoke: buildTenantBackupZip for test1 (or SOURCE_SLUG).
 * Usage: npx tsx scripts/smoke-backup-export.ts
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { prisma } from "../src/config/database";
import { buildTenantBackupZip } from "../src/modules/system-migration/system-migration.export";

async function main() {
  const slug = (process.env.SOURCE_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) throw new Error(`Tenant topilmadi: ${slug}`);
  console.log(`[smoke-export] tenant=${tenant.slug} id=${tenant.id}`);
  const t0 = Date.now();
  const buf = await buildTenantBackupZip({
    tenantId: tenant.id,
    tenantSlug: tenant.slug
  });
  const ms = Date.now() - t0;
  const outDir = join(process.cwd(), "tmp");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `smoke-backup-${tenant.slug}.zip`);
  writeFileSync(out, buf);
  console.log(`[smoke-export] OK bytes=${buf.length} ms=${ms} → ${out}`);
}

main()
  .catch((e) => {
    console.error("[smoke-export] FAIL:", e instanceof Error ? e.message : e);
    if (e instanceof Error && e.stack) console.error(e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
