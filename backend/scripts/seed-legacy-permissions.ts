import { prisma } from "../src/config/database";
import { syncDefaultPermissionMetadata } from "../src/modules/access/permission-catalog.service";

/**
 * Upserts default + legacy permission catalog rows for every tenant (idempotent).
 * Catalog is also refreshed on GET .../access/permissions/catalog.
 */
async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, slug: true } });
  for (const t of tenants) {
    await syncDefaultPermissionMetadata(t.id);
    // eslint-disable-next-line no-console
    console.log(`Synced permission catalog for tenant ${t.slug} (${t.id})`);
  }
  // eslint-disable-next-line no-console
  console.log(`Done. tenants=${tenants.length}`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
