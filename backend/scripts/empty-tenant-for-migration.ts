/**
 * test1 (yoki TENANT_SLUG) ni migratsiya importi uchun «bo‘sh» holatga keltirish:
 * orders/payments/clients/products (+ bog‘liq operatsion) o‘chiriladi.
 * Admin / user / ombor / rol saqlanadi.
 *
 *   npx tsx scripts/empty-tenant-for-migration.ts
 *   $env:TENANT_SLUG="test1"; npx tsx scripts/empty-tenant-for-migration.ts
 */
import "dotenv/config";
import { prisma } from "../src/config/database";
import { isTargetTenantEmptyForImport } from "../src/modules/system-migration/system-migration.inventory";
import { purgeTenantClientsForReplace } from "../src/modules/system-migration/system-migration.import.purge";

async function main() {
  const slug = (process.env.TENANT_SLUG || "test1").trim();
  const tenant = await prisma.tenant.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) {
    console.error(`[empty-tenant] Tenant topilmadi: ${slug}`);
    process.exit(1);
  }

  const before = await isTargetTenantEmptyForImport(tenant.id);
  console.log(`[empty-tenant] ${tenant.slug} (#${tenant.id}) before:`, before);

  if (before.empty) {
    console.log("[empty-tenant] Allaqachon bo‘sh (orders/payments/clients/products = 0).");
    await prisma.$disconnect();
    return;
  }

  console.log("[empty-tenant] Tozalanmoqda (clients + products + ops + audit + bonus)…");
  await purgeTenantClientsForReplace(tenant.id);

  const after = await isTargetTenantEmptyForImport(tenant.id);
  console.log(`[empty-tenant] after:`, after);
  if (!after.empty) {
    console.error("[empty-tenant] Hali blocker bor:", after.blockers);
    process.exit(1);
  }
  console.log("[empty-tenant] Tayyor. Admin bilan kiring va ZIP import qiling.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
